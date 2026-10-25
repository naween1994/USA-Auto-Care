import express from 'express';
import { Reminder } from '../models/Reminder.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

/**
 * Integration-ready messaging adapter interface for future Sri Lankan SMS / WhatsApp gateways
 * (e.g., Dialog eSMS, Mobitel mSpace, Hutch, or Meta WhatsApp Cloud API).
 * Explicitly does NOT pretend an automated message was sent in v1.
 */
export const notificationProviderAdapter = {
  providerName: 'MANUAL_STAFF_CONTACT_V1',
  isAutomatedGatewayConfigured: false,
};

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const filter = { isArchived: { $ne: true } };
    if (req.query.status) filter.status = req.query.status;
    const reminders = await Reminder.find(filter)
      .populate('customer', 'name phone email')
      .populate('vehicle', 'registrationNumber make model mileageKm nextServiceDate nextServiceMileageKm')
      .populate('contactedBy', 'name')
      .sort({ dueDate: 1 })
      .lean();

    return res.json({
      data: reminders,
      messagingGateway: notificationProviderAdapter,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, verifyCsrf, requirePermission('MANAGE_APPOINTMENTS'), async (req, res, next) => {
  try {
    const created = await Reminder.create({
      customer: req.body.customer,
      vehicle: req.body.vehicle,
      dueDate: new Date(req.body.dueDate),
      dueMileageKm: req.body.dueMileageKm || null,
      serviceType: req.body.serviceType || 'Periodic Maintenance Service',
    });
    emitDomainEvent('reminders', 'created', { id: created._id });
    return res.status(201).json({ data: created });
  } catch (err) {
    return next(err);
  }
});

// Manual "Mark Contacted" action recorded honestly by workshop staff
router.patch(
  '/:id/contacted',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_APPOINTMENTS'),
  async (req, res, next) => {
    try {
      const reminder = await Reminder.findById(req.params.id);
      if (!reminder) return res.status(404).json({ message: 'Reminder not found' });

      reminder.status = req.body.status || 'Contacted';
      reminder.contactedAt = new Date();
      reminder.contactedBy = req.user._id;
      reminder.contactMethod = req.body.contactMethod || 'Phone Call';
      reminder.contactNotes = req.body.contactNotes || '';
      await reminder.save();

      emitDomainEvent('reminders', 'updated', { id: reminder._id });
      return res.json({ data: reminder });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
