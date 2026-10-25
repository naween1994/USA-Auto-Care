import express from 'express';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { assertVersionMatch } from '../utils/dbTransaction.js';
import { toMinorUnits } from '../utils/domainLogic.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

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
