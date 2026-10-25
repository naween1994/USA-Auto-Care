import express from 'express';
import { Estimate } from '../models/Estimate.js';
import { JobCard } from '../models/JobCard.js';
import { AuditLog } from '../models/AuditLog.js';
import { Counter } from '../models/Counter.js';
import { estimatePayloadSchema, estimateApprovalSchema } from '../validators/schemas.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { assertVersionMatch } from '../utils/dbTransaction.js';
import { toMinorUnits, calculateDocumentTotals } from '../utils/domainLogic.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const query = { isArchived: { $ne: true } };
    if (req.query.jobCardId) query.jobCard = req.query.jobCardId;
    if (req.query.status) query.status = req.query.status;

    const items = await Estimate.find(query)
      .populate('jobCard', 'jobNumber status')
      .populate('customer', 'name phone')
      .populate('vehicle', 'registrationNumber make model')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ data: items });
  } catch (err) {
    return next(err);
  }
});

// Create initial estimate for a job card
router.post(
  '/',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_ESTIMATES'),
  async (req, res, next) => {
    try {
      const parsed = estimatePayloadSchema.parse(req.body);
      const job = await JobCard.findById(parsed.jobCard);
      if (!job) return res.status(404).json({ message: 'Job card not found' });

      const estimateNumber = await Counter.nextSequence('ESTIMATE', 'EST', 5);

      const totals = calculateDocumentTotals({
        parts: parsed.parts.map((p) => ({
          ...p,
          unitPriceMinor: toMinorUnits(p.unitPriceLkr),
          unitCostMinor: toMinorUnits(p.unitCostLkr || 0),
        })),
        labour: parsed.labour.map((l) => ({
          ...l,
          rateMinor: toMinorUnits(l.rateLkr),
        })),
        discountMinor: toMinorUnits(parsed.discountLkr || 0),
        taxEnabled: Boolean(parsed.taxEnabled),
        taxRatePercent: Number(parsed.taxRatePercent || 0),
      });

      const created = await Estimate.create({
        estimateNumber,
        jobCard: job._id,
        customer: job.customer,
        vehicle: job.vehicle,
        currentRevision: 1,
        status: 'Draft',
        parts: totals.parts,
        labour: totals.labour,
        partsSubtotalMinor: totals.partsSubtotalMinor,
        labourSubtotalMinor: totals.labourSubtotalMinor,
        discountMinor: totals.discountMinor,
        taxEnabled: totals.taxEnabled,
        taxRatePercent: totals.taxRatePercent,
        taxAmountMinor: totals.taxAmountMinor,
        grandTotalMinor: totals.grandTotalMinor,
        notes: parsed.notes || '',
        revisions: [
          {
            revisionNumber: 1,
            status: 'Draft',
            parts: totals.parts,
            labour: totals.labour,
            partsSubtotalMinor: totals.partsSubtotalMinor,
            labourSubtotalMinor: totals.labourSubtotalMinor,
            discountMinor: totals.discountMinor,
            taxEnabled: totals.taxEnabled,
            taxRatePercent: totals.taxRatePercent,
            taxAmountMinor: totals.taxAmountMinor,
            grandTotalMinor: totals.grandTotalMinor,
          },
        ],
      });

      emitDomainEvent('estimates', 'created', { id: created._id, jobCardId: job._id });
      return res.status(201).json({ data: created });
    } catch (err) {
      return next(err);
    }
  }
);

// Update estimate or create a new revision if already Approved (preserving approved revision history)
router.put(
  '/:id',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_ESTIMATES'),
  async (req, res, next) => {
    try {
      const parsed = estimatePayloadSchema.parse(req.body);
      const estimate = await Estimate.findById(req.params.id);
      if (!estimate) return res.status(404).json({ message: 'Estimate not found' });

      assertVersionMatch(estimate, parsed.__v);

      const totals = calculateDocumentTotals({
        parts: parsed.parts.map((p) => ({
          ...p,
          unitPriceMinor: toMinorUnits(p.unitPriceLkr),
          unitCostMinor: toMinorUnits(p.unitCostLkr || 0),
        })),
        labour: parsed.labour.map((l) => ({
          ...l,
          rateMinor: toMinorUnits(l.rateLkr),
        })),
        discountMinor: toMinorUnits(parsed.discountLkr || 0),
        taxEnabled: Boolean(parsed.taxEnabled),
        taxRatePercent: Number(parsed.taxRatePercent || 0),
      });

      // If previous revision was Approved or Rejected, increment revision number and require fresh approval
      const createsNewRevision = ['Approved', 'Rejected'].includes(estimate.status);
      if (createsNewRevision) {
        estimate.currentRevision += 1;
        estimate.status = 'Draft';
        estimate.approvalDetails = {
          method: null,
          approvingCustomerName: '',
          approvedAt: null,
          recordedBy: null,
          recordedByName: '',
          notes: '',
        };
      }

      estimate.parts = totals.parts;
      estimate.labour = totals.labour;
      estimate.partsSubtotalMinor = totals.partsSubtotalMinor;
      estimate.labourSubtotalMinor = totals.labourSubtotalMinor;
      estimate.discountMinor = totals.discountMinor;
      estimate.taxEnabled = totals.taxEnabled;
      estimate.taxRatePercent = totals.taxRatePercent;
      estimate.taxAmountMinor = totals.taxAmountMinor;
      estimate.grandTotalMinor = totals.grandTotalMinor;
      estimate.notes = parsed.notes || '';

      const snapshot = {
        revisionNumber: estimate.currentRevision,
        status: estimate.status,
        parts: totals.parts,
        labour: totals.labour,
        partsSubtotalMinor: totals.partsSubtotalMinor,
        labourSubtotalMinor: totals.labourSubtotalMinor,
        discountMinor: totals.discountMinor,
        taxEnabled: totals.taxEnabled,
        taxRatePercent: totals.taxRatePercent,
        taxAmountMinor: totals.taxAmountMinor,
        grandTotalMinor: totals.grandTotalMinor,
        approvalDetails: estimate.approvalDetails,
        createdAt: new Date(),
      };

      if (createsNewRevision) {
        estimate.revisions.push(snapshot);
      } else if (estimate.revisions.length > 0) {
        estimate.revisions[estimate.revisions.length - 1] = snapshot;
      } else {
        estimate.revisions.push(snapshot);
      }

      await estimate.save();

      emitDomainEvent('estimates', 'updated', { id: estimate._id });
      return res.json({ data: estimate });
    } catch (err) {
      return next(err);
    }
  }
);

// Record estimate status change (Sent / Approved / Rejected) with staff & customer approval details
router.patch(
  '/:id/approval',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_ESTIMATES'),
  async (req, res, next) => {
    try {
      const parsed = estimateApprovalSchema.parse(req.body);
      const estimate = await Estimate.findById(req.params.id);
      if (!estimate) return res.status(404).json({ message: 'Estimate not found' });

      assertVersionMatch(estimate, parsed.__v);

      if (parsed.status === 'Approved') {
        if (!parsed.method || !parsed.approvingCustomerName?.trim()) {
          return res.status(400).json({
            message: 'Approval method (In-Person or Phone) and approving customer name are required.',
          });
        }
        estimate.approvalDetails = {
          method: parsed.method,
          approvingCustomerName: parsed.approvingCustomerName.trim(),
          approvedAt: new Date(),
          recordedBy: req.user._id,
          recordedByName: req.user.name,
          notes: parsed.notes || '',
        };
      }

      estimate.status = parsed.status;
      if (estimate.revisions.length > 0) {
        const lastRev = estimate.revisions[estimate.revisions.length - 1];
        lastRev.status = parsed.status;
        lastRev.approvalDetails = estimate.approvalDetails;
      }

      await estimate.save();

      await AuditLog.create({
        action: `ESTIMATE_${parsed.status.toUpperCase()}`,
        entityType: 'Estimate',
        entityId: String(estimate._id),
        summary: `Estimate ${estimate.estimateNumber} (Rev ${estimate.currentRevision}) marked ${parsed.status}`,
        metadata: {
          estimateNumber: estimate.estimateNumber,
          revision: estimate.currentRevision,
          method: parsed.method || null,
          approvingCustomerName: parsed.approvingCustomerName || null,
        },
        performedBy: req.user._id,
        performedByName: req.user.name,
        performedByRole: req.user.role,
      });

      emitDomainEvent('estimates', 'approvalChanged', { id: estimate._id, status: estimate.status });
      emitDomainEvent('dashboard', 'refresh', {});

      return res.json({ data: estimate });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
