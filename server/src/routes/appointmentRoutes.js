import express from 'express';
import { Appointment } from '../models/Appointment.js';
import { appointmentSchema } from '../validators/schemas.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { assertVersionMatch } from '../utils/dbTransaction.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const status = req.query.status;
    const date = req.query.date;

    const query = {};
    if (status) query.status = status;
    if (date) {
      const start = new Date(`${date}T00:00:00.000+05:30`);
      const end = new Date(`${date}T23:59:59.999+05:30`);
      query.scheduledAt = { $gte: start, $lte: end };
    }

    const [total, items] = await Promise.all([
      Appointment.countDocuments(query),
      Appointment.find(query)
        .populate('customer', 'name phone email')
        .populate('vehicle', 'registrationNumber make model mileageKm')
        .populate('convertedJobCard', 'jobNumber status')
        .sort({ scheduledAt: 1 })
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

router.post(
  '/',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_APPOINTMENTS'),
  async (req, res, next) => {
    try {
      const parsed = appointmentSchema.parse(req.body);
      const created = await Appointment.create({
        customer: parsed.customer,
        vehicle: parsed.vehicle,
        isWalkIn: Boolean(parsed.isWalkIn),
        requestedService: parsed.requestedService,
        scheduledAt: new Date(parsed.scheduledAt),
        notes: parsed.notes || '',
        status: parsed.isWalkIn ? 'Arrived' : parsed.status || 'Scheduled',
        createdBy: req.user._id,
      });

      const populated = await Appointment.findById(created._id)
        .populate('customer', 'name phone')
        .populate('vehicle', 'registrationNumber make model mileageKm');

      emitDomainEvent('appointments', 'created', { id: created._id });
      emitDomainEvent('dashboard', 'refresh', {});
      return res.status(201).json({ data: populated });
    } catch (err) {
      return next(err);
    }
  }
);

router.patch(
  '/:id',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_APPOINTMENTS'),
  async (req, res, next) => {
    try {
      const doc = await Appointment.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: 'Appointment not found' });

      assertVersionMatch(doc, req.body.__v);

      if (req.body.status) doc.status = req.body.status;
      if (req.body.scheduledAt) doc.scheduledAt = new Date(req.body.scheduledAt);
      if (req.body.requestedService) doc.requestedService = req.body.requestedService;
      if (req.body.notes !== undefined) doc.notes = req.body.notes;

      await doc.save();

      emitDomainEvent('appointments', 'updated', { id: doc._id });
      emitDomainEvent('dashboard', 'refresh', {});
      return res.json({ data: doc });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
