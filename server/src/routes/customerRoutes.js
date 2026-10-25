import express from 'express';
import { Customer } from '../models/Customer.js';
import { Vehicle } from '../models/Vehicle.js';
import { JobCard } from '../models/JobCard.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { AuditLog } from '../models/AuditLog.js';
import { customerSchema } from '../validators/schemas.js';
import {
  adminPasswordLimiter,
  requireAdminPassword,
  requireAuth,
  requirePermission,
  verifyCsrf,
} from '../middleware/auth.js';
import { assertVersionMatch, withTransaction } from '../utils/dbTransaction.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const includeArchived = req.query.includeArchived === 'true';

    const query = includeArchived ? {} : { isArchived: { $ne: true } };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, items] = await Promise.all([
      Customer.countDocuments(query),
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const [vehicles, jobs, invoices, payments] = await Promise.all([
      Vehicle.find({ customer: customer._id, isArchived: false }).sort({ createdAt: -1 }).lean(),
      JobCard.find({ customer: customer._id })
        .populate('vehicle', 'registrationNumber make model')
        .sort({ checkInAt: -1 })
        .lean(),
      Invoice.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
      Payment.find({ customer: customer._id }).sort({ paidAt: -1 }).lean(),
    ]);

    return res.json({
      data: {
        ...customer,
        vehicles,
        jobs,
        invoices,
        payments,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_CUSTOMERS_VEHICLES'),
  async (req, res, next) => {
    try {
      const parsed = customerSchema.parse(req.body);
      const created = await Customer.create({
        ...parsed,
        createdBy: req.user._id,
      });

      emitDomainEvent('customers', 'created', { id: created._id });
      return res.status(201).json({ data: created });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:id',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_CUSTOMERS_VEHICLES'),
  async (req, res, next) => {
    try {
      const parsed = customerSchema.parse(req.body);
      const doc = await Customer.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: 'Customer not found' });

      assertVersionMatch(doc, parsed.__v);

      doc.name = parsed.name;
      doc.phone = parsed.phone;
      doc.email = parsed.email || '';
      doc.address = parsed.address || '';
      doc.notes = parsed.notes || '';
      await doc.save();

      emitDomainEvent('customers', 'updated', { id: doc._id });
      return res.json({ data: doc });
    } catch (err) {
      return next(err);
    }
  }
);

// Soft-archive customer (no hard deletion of records referenced by service/financial history)
router.patch(
  '/:id/archive',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  adminPasswordLimiter,
  requireAdminPassword,
  async (req, res, next) => {
    try {
      const isArchived = req.body.isArchived ?? true;
      if (typeof isArchived !== 'boolean') {
        return res.status(400).json({ message: 'isArchived must be true or false.' });
      }
      const doc = await withTransaction(async (session) => {
        const customer = await Customer.findById(req.params.id).session(session);
        if (!customer) {
          const error = new Error('Customer not found');
          error.statusCode = 404;
          throw error;
        }
        if (Boolean(customer.isArchived) === isArchived) {
          const error = new Error(isArchived ? 'Customer is already archived.' : 'Customer is already active.');
          error.statusCode = 409;
          throw error;
        }
        customer.isArchived = isArchived;
        await customer.save({ session });
        await AuditLog.create(
          [{
            action: isArchived ? 'RECORD_ARCHIVED' : 'RECORD_RESTORED',
            entityType: 'Customer',
            entityId: String(customer._id),
            summary: `${isArchived ? 'Archived' : 'Restored'} customer record`,
            metadata: { recordType: 'customers' },
            performedBy: req.user._id,
            performedByName: req.user.name,
            performedByRole: req.user.role,
          }],
          { session }
        );
        return customer;
      });

      emitDomainEvent('customers', isArchived ? 'archived' : 'restored', { id: doc._id, isArchived });
      return res.json({ data: doc });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
