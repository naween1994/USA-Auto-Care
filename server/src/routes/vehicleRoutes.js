import express from 'express';
import { Vehicle } from '../models/Vehicle.js';
import { JobCard } from '../models/JobCard.js';
import { Invoice } from '../models/Invoice.js';
import { Reminder } from '../models/Reminder.js';
import { vehicleSchema } from '../validators/schemas.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { normalizeRegistrationNumber } from '../utils/domainLogic.js';
import { assertVersionMatch } from '../utils/dbTransaction.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const customerId = req.query.customerId;

    const query = { isArchived: { $ne: true } };
    if (customerId) query.customer = customerId;
    if (search) {
      const normalized = normalizeRegistrationNumber(search);
      query.$or = [
        { normalizedRegistration: { $regex: normalized || search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { vin: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, items] = await Promise.all([
      Vehicle.countDocuments(query),
      Vehicle.find(query)
        .populate('customer', 'name phone email')
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

router.get('/:id/history', requireAuth, async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('customer', 'name phone email address')
      .lean();
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    const [jobs, invoices, reminders] = await Promise.all([
      JobCard.find({ vehicle: vehicle._id })
        .populate('assignedMechanic', 'name')
        .sort({ checkInAt: -1 })
        .lean(),
      Invoice.find({ vehicle: vehicle._id }).sort({ createdAt: -1 }).lean(),
      Reminder.find({ vehicle: vehicle._id }).sort({ dueDate: -1 }).lean(),
    ]);

    return res.json({
      data: {
        vehicle,
        jobs,
        invoices,
        reminders,
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
      const parsed = vehicleSchema.parse(req.body);
      const normalizedRegistration = normalizeRegistrationNumber(parsed.registrationNumber);
      const existing = await Vehicle.findOne({ normalizedRegistration });
      if (existing) {
        return res.status(409).json({
          message: `A vehicle with registration ${normalizedRegistration} is already registered.`,
        });
      }

      const created = await Vehicle.create({
        ...parsed,
        registrationNumber: normalizedRegistration,
        normalizedRegistration,
        nextServiceDate: parsed.nextServiceDate ? new Date(parsed.nextServiceDate) : null,
      });

      emitDomainEvent('vehicles', 'created', { id: created._id });
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
      const parsed = vehicleSchema.parse(req.body);
      const doc = await Vehicle.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: 'Vehicle not found' });

      assertVersionMatch(doc, parsed.__v);

      const normalizedRegistration = normalizeRegistrationNumber(parsed.registrationNumber);
      const duplicate = await Vehicle.findOne({
        normalizedRegistration,
        _id: { $ne: doc._id },
      });
      if (duplicate) {
        return res.status(409).json({
          message: `Another vehicle already uses registration ${normalizedRegistration}.`,
        });
      }

      doc.customer = parsed.customer;
      doc.registrationNumber = normalizedRegistration;
      doc.normalizedRegistration = normalizedRegistration;
      doc.make = parsed.make;
      doc.model = parsed.model;
      doc.year = parsed.year;
      doc.fuelType = parsed.fuelType;
      doc.transmission = parsed.transmission;
      doc.mileageKm = parsed.mileageKm;
      doc.vin = parsed.vin || '';
      doc.engineNumber = parsed.engineNumber || '';
      doc.notes = parsed.notes || '';
      if (parsed.nextServiceDate !== undefined) {
        doc.nextServiceDate = parsed.nextServiceDate ? new Date(parsed.nextServiceDate) : null;
      }
      if (parsed.nextServiceMileageKm !== undefined) {
        doc.nextServiceMileageKm = parsed.nextServiceMileageKm;
      }

      await doc.save();
      emitDomainEvent('vehicles', 'updated', { id: doc._id });
      return res.json({ data: doc });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
