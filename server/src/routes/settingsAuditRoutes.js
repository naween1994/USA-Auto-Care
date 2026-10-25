import express from 'express';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { Customer } from '../models/Customer.js';
import { Vehicle } from '../models/Vehicle.js';
import { Appointment } from '../models/Appointment.js';
import { JobCard } from '../models/JobCard.js';
import { Estimate } from '../models/Estimate.js';
import { Invoice } from '../models/Invoice.js';
import { Part } from '../models/Part.js';
import { Payment } from '../models/Payment.js';
import { Supplier } from '../models/Supplier.js';
import { Expense } from '../models/Expense.js';
import { Reminder } from '../models/Reminder.js';
import { StockMovement } from '../models/StockMovement.js';
import {
  adminPasswordLimiter,
  requireAdminPassword,
  requireAuth,
  requirePermission,
  verifyCsrf,
} from '../middleware/auth.js';
import { assertVersionMatch, withTransaction } from '../utils/dbTransaction.js';
import { toMinorUnits } from '../utils/domainLogic.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

const archivableRecords = {
  customers: { model: Customer, label: 'Customers', fields: ['name', 'phone', 'email'] },
  vehicles: { model: Vehicle, label: 'Vehicles', fields: ['registrationNumber', 'make', 'model'] },
  appointments: { model: Appointment, label: 'Appointments', fields: ['requestedService', 'status'] },
  jobCards: { model: JobCard, label: 'Job cards', fields: ['jobNumber', 'status', 'customerComplaints'] },
  estimates: { model: Estimate, label: 'Estimates', fields: ['estimateNumber', 'status'] },
  parts: { model: Part, label: 'Inventory parts', fields: ['sku', 'name', 'category'] },
  suppliers: { model: Supplier, label: 'Suppliers', fields: ['name', 'phone'] },
  expenses: { model: Expense, label: 'Expenses', fields: ['category', 'notes'] },
  reminders: { model: Reminder, label: 'Service reminders', fields: ['serviceType', 'status'] },
};

const deletionReferences = {
  customers: [
    { model: Vehicle, filter: (id) => ({ customer: id }), label: 'vehicles' },
    { model: Appointment, filter: (id) => ({ customer: id }), label: 'appointments' },
    { model: JobCard, filter: (id) => ({ customer: id }), label: 'job cards' },
    { model: Estimate, filter: (id) => ({ customer: id }), label: 'estimates' },
    { model: Invoice, filter: (id) => ({ customer: id }), label: 'invoices' },
    { model: Payment, filter: (id) => ({ customer: id }), label: 'payments' },
    { model: Reminder, filter: (id) => ({ customer: id }), label: 'service reminders' },
  ],
  vehicles: [
    { model: Appointment, filter: (id) => ({ vehicle: id }), label: 'appointments' },
    { model: JobCard, filter: (id) => ({ vehicle: id }), label: 'job cards' },
    { model: Estimate, filter: (id) => ({ vehicle: id }), label: 'estimates' },
    { model: Invoice, filter: (id) => ({ vehicle: id }), label: 'invoices' },
    { model: Reminder, filter: (id) => ({ vehicle: id }), label: 'service reminders' },
  ],
  appointments: [
    { model: JobCard, filter: (id) => ({ appointment: id }), label: 'job cards' },
  ],
  jobCards: [
    { model: Appointment, filter: (id) => ({ convertedJobCard: id }), label: 'converted appointments' },
    { model: Estimate, filter: (id) => ({ jobCard: id }), label: 'estimates' },
    { model: Invoice, filter: (id) => ({ jobCard: id }), label: 'invoices' },
    { model: Reminder, filter: (id) => ({ jobCard: id }), label: 'service reminders' },
    { model: StockMovement, filter: (id) => ({ jobCard: id }), label: 'stock movements' },
  ],
  estimates: [
    { model: Invoice, filter: (id) => ({ estimate: id }), label: 'invoices' },
  ],
  parts: [
    { model: StockMovement, filter: (id) => ({ part: id }), label: 'stock movements' },
    { model: JobCard, filter: (id) => ({ 'issuedParts.part': id }), label: 'job card part records' },
    { model: Estimate, filter: (id) => ({ 'parts.part': id }), label: 'estimate part records' },
    { model: Invoice, filter: (id) => ({ 'parts.part': id }), label: 'invoice part records' },
  ],
  suppliers: [
    { model: Part, filter: (id) => ({ supplier: id }), label: 'inventory parts' },
    { model: StockMovement, filter: (id) => ({ supplier: id }), label: 'stock movements' },
  ],
};

async function findDeletionBlocker(recordType, target, session) {
  if (recordType === 'customers' && target.depositBalanceMinor > 0) {
    return 'This customer has an outstanding deposit balance.';
  }
  if (recordType === 'parts' && target.quantityOnHand > 0) {
    return 'This part still has stock on hand. Adjust the stock to zero before deleting it.';
  }
  if (recordType === 'estimates' && target.status === 'Approved') {
    return 'Approved estimates are part of the customer approval history and cannot be permanently deleted.';
  }

  for (const reference of deletionReferences[recordType] || []) {
    const exists = await reference.model.exists(reference.filter(target._id)).session(session);
    if (exists) return `This record is linked to ${reference.label}; those records must be preserved.`;
  }
  return null;
}

router.get(
  '/records',
  requireAuth,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  async (req, res, next) => {
    try {
      const type = req.query.type;
      if (!Object.hasOwn(archivableRecords, type)) {
        return res.status(400).json({ message: 'Choose a supported record category.' });
      }
      const recordType = archivableRecords[type];

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const [total, records] = await Promise.all([
        recordType.model.countDocuments(),
        recordType.model
          .find()
          .sort({ updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);
      return res.json({
        data: records.map((record) => ({
          _id: record._id,
          isArchived: Boolean(record.isArchived),
          updatedAt: record.updatedAt,
          label: recordType.fields
            .map((field) => record[field])
            .filter((value) => value !== undefined && value !== null && value !== '')
            .join(' • '),
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.patch(
  '/records/:type/:id/archive',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  adminPasswordLimiter,
  requireAdminPassword,
  async (req, res, next) => {
    try {
      if (!Object.hasOwn(archivableRecords, req.params.type)) {
        return res.status(400).json({ message: 'This record category cannot be archived here.' });
      }
      const recordType = archivableRecords[req.params.type];
      if (typeof req.body.isArchived !== 'boolean') {
        return res.status(400).json({ message: 'Choose whether to archive or restore this record.' });
      }

      const record = await withTransaction(async (session) => {
        const target = await recordType.model.findById(req.params.id).session(session);
        if (!target) {
          const error = new Error('Record not found.');
          error.statusCode = 404;
          throw error;
        }
        if (Boolean(target.isArchived) === req.body.isArchived) {
          const error = new Error(req.body.isArchived ? 'This record is already archived.' : 'This record is already active.');
          error.statusCode = 409;
          throw error;
        }

        target.isArchived = req.body.isArchived;
        await target.save({ session });

        await AuditLog.create(
          [{
            action: req.body.isArchived ? 'RECORD_ARCHIVED' : 'RECORD_RESTORED',
            entityType: recordType.model.modelName,
            entityId: String(target._id),
            summary: `${req.body.isArchived ? 'Archived' : 'Restored'} ${recordType.label.slice(0, -1)} record`,
            metadata: { recordType: req.params.type },
            performedBy: req.user._id,
            performedByName: req.user.name,
            performedByRole: req.user.role,
          }],
          { session }
        );
        return target;
      });

      emitDomainEvent(req.params.type, req.body.isArchived ? 'archived' : 'restored', { id: record._id });
      return res.json({ message: req.body.isArchived ? 'Record archived.' : 'Record restored.' });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/records/:type/:id',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  adminPasswordLimiter,
  requireAdminPassword,
  async (req, res, next) => {
    try {
      if (!Object.hasOwn(deletionReferences, req.params.type)) {
        return res.status(400).json({
          message: 'This record category cannot be permanently deleted. Financial records and protected history must be archived or corrected using their designated workflows.',
        });
      }
      if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
        return res.status(400).json({ message: 'Enter a valid record ID.' });
      }

      const recordType = archivableRecords[req.params.type];
      const deletedRecord = await withTransaction(async (session) => {
        const target = await recordType.model.findById(req.params.id).session(session);
        if (!target) {
          const error = new Error('Record not found. It may already have been deleted.');
          error.statusCode = 404;
          throw error;
        }

        const blocker = await findDeletionBlocker(req.params.type, target, session);
        if (blocker) {
          const error = new Error(blocker);
          error.statusCode = 409;
          error.code = 'RECORD_HAS_LINKED_HISTORY';
          throw error;
        }

        const deletedId = String(target._id);
        const summary = `${recordType.label} record permanently deleted`;
        await target.deleteOne({ session });
        await AuditLog.create(
          [{
            action: 'RECORD_DELETED',
            entityType: recordType.model.modelName,
            entityId: deletedId,
            summary,
            metadata: { recordType: req.params.type },
            performedBy: req.user._id,
            performedByName: req.user.name,
            performedByRole: req.user.role,
          }],
          { session }
        );
        return { id: deletedId };
      });

      emitDomainEvent(req.params.type, 'deleted', { id: deletedRecord.id });
      return res.json({ message: 'Record permanently deleted from MongoDB.', id: deletedRecord.id });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/settings', requireAuth, async (_req, res, next) => {
  try {
    let settings = await BusinessSettings.findOne({ singletonKey: 'DEFAULT' }).lean();
    if (!settings) {
      settings = await BusinessSettings.create({ singletonKey: 'DEFAULT' });
    }
    return res.json({ data: settings });
  } catch (err) {
    return next(err);
  }
});

router.put(
  '/settings',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  async (req, res, next) => {
    try {
      let settings = await BusinessSettings.findOne({ singletonKey: 'DEFAULT' });
      if (!settings) {
        settings = new BusinessSettings({ singletonKey: 'DEFAULT' });
      } else {
        assertVersionMatch(settings, req.body.__v);
      }

      if (req.body.businessName !== undefined) settings.businessName = req.body.businessName;
      if (req.body.location !== undefined) settings.location = req.body.location;
      if (req.body.phone !== undefined) settings.phone = req.body.phone;
      if (req.body.streetAddress !== undefined) settings.streetAddress = req.body.streetAddress;
      if (req.body.taxRegistrationNumber !== undefined) {
        settings.taxRegistrationNumber = req.body.taxRegistrationNumber;
      }
      if (req.body.establishedYear !== undefined) {
        settings.establishedYear = req.body.establishedYear ? Number(req.body.establishedYear) : null;
      }
      if (req.body.logoUrl !== undefined) settings.logoUrl = req.body.logoUrl;
      if (req.body.invoiceFooter !== undefined) settings.invoiceFooter = req.body.invoiceFooter;
      if (req.body.taxEnabled !== undefined) settings.taxEnabled = Boolean(req.body.taxEnabled);
      if (req.body.taxLabel !== undefined) settings.taxLabel = req.body.taxLabel;
      if (req.body.taxRatePercent !== undefined) {
        settings.taxRatePercent = Number(req.body.taxRatePercent);
      }
      if (req.body.defaultLabourRateLkr !== undefined) {
        settings.defaultLabourRateMinor = toMinorUnits(req.body.defaultLabourRateLkr);
      }
      if (Array.isArray(req.body.serviceCategories)) {
        settings.serviceCategories = req.body.serviceCategories;
      }

      await settings.save();

      await AuditLog.create({
        action: 'BUSINESS_SETTINGS_UPDATED',
        entityType: 'BusinessSettings',
        entityId: String(settings._id),
        summary: 'Updated USA Auto Care business settings & tax configuration',
        metadata: {
          taxEnabled: settings.taxEnabled,
          taxRatePercent: settings.taxRatePercent,
        },
        performedBy: req.user._id,
        performedByName: req.user.name,
        performedByRole: req.user.role,
      });

      emitDomainEvent('settings', 'updated', {});
      return res.json({ data: settings });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/audit-logs',
  requireAuth,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  async (req, res, next) => {
    try {
      const limit = Math.min(200, Number(req.query.limit) || 100);
      const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
      return res.json({ data: logs });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
