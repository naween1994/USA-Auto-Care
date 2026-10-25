import express from 'express';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { JobCard } from '../models/JobCard.js';
import { Estimate } from '../models/Estimate.js';
import { Customer } from '../models/Customer.js';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { Counter } from '../models/Counter.js';
import { createInvoiceFromJobSchema, recordPaymentSchema } from '../validators/schemas.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { withTransaction } from '../utils/dbTransaction.js';
import {
  toMinorUnits,
  calculateDocumentTotals,
  deriveInvoiceBalanceAndStatus,
  getApprovedEstimateRevision,
  mapEstimateRevisionToInvoiceLines,
  validatePaymentSubmission,
} from '../utils/domainLogic.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

router.get('/invoices', requireAuth, requirePermission('MANAGE_INVOICES_PAYMENTS'), async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.customerId) query.customer = req.query.customerId;
    if (req.query.jobCardId) query.jobCard = req.query.jobCardId;

    const invoices = await Invoice.find(query)
      .populate('customer', 'name phone email address depositBalanceMinor')
      .populate('vehicle', 'registrationNumber make model year mileageKm')
      .populate('jobCard', 'jobNumber status checkInAt deliveredAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ data: invoices });
  } catch (err) {
    return next(err);
  }
});

router.get('/invoices/:id', requireAuth, requirePermission('MANAGE_INVOICES_PAYMENTS'), async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer', 'name phone email address depositBalanceMinor')
      .populate('vehicle', 'registrationNumber make model year fuelType mileageKm vin')
      .populate('jobCard', 'jobNumber status checkInAt deliveredAt')
      .lean();
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const payments = await Payment.find({ invoice: invoice._id })
      .populate('receivedBy', 'name role')
      .sort({ paidAt: 1 })
      .lean();

    return res.json({ data: { ...invoice, payments } });
  } catch (err) {
    return next(err);
  }
});

// Create invoice directly from Job Card without duplicate entry or double stock deduction
router.post(
  '/invoices/from-job',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_INVOICES_PAYMENTS'),
  async (req, res, next) => {
    try {
      const parsed = createInvoiceFromJobSchema.parse(req.body);

      const createdInvoice = await withTransaction(async (session) => {
        const existing = await Invoice.findOne({ jobCard: parsed.jobCardId, isVoided: false }).session(session);
        if (existing) {
          throw new Error(`An active invoice (${existing.invoiceNumber}) already exists for this job card.`);
        }

        const job = await JobCard.findById(parsed.jobCardId).session(session);
        if (!job) throw new Error('Job card not found');

        const approvedEstimates = await Estimate.find({
          jobCard: job._id,
          status: 'Approved',
          isArchived: { $ne: true },
        })
          .sort({ 'approvalDetails.approvedAt': -1 })
          .session(session);
        const approvedEstimate = approvedEstimates.find((estimate) =>
          estimate.revisions?.some(
            (revision) =>
              revision.revisionNumber === estimate.currentRevision && revision.status === 'Approved'
          )
        );
        if (!approvedEstimate) {
          if (approvedEstimates.length > 0) {
            throw new Error('The current approved estimate revision could not be found.');
          }
          throw new Error('An approved estimate is required before generating an invoice.');
        }
        const approvedRevision = getApprovedEstimateRevision(approvedEstimate);
        const approvedLines = mapEstimateRevisionToInvoiceLines(approvedRevision);

        const settings =
          (await BusinessSettings.findOne({ singletonKey: 'DEFAULT' }).session(session)) || {};

        const totals = calculateDocumentTotals({
          parts: approvedLines.parts,
          labour: approvedLines.labour,
          discountMinor: approvedLines.discountMinor,
          taxEnabled: approvedLines.taxEnabled,
          taxRatePercent: approvedLines.taxRatePercent,
        });
        if (totals.grandTotalMinor <= 0) {
          throw new Error('The approved estimate total must be greater than zero to generate an invoice.');
        }

        const invoiceNumber = await Counter.nextSequence('INVOICE', 'INV', 5, session);

        const [invoice] = await Invoice.create(
          [
            {
              invoiceNumber,
              jobCard: job._id,
              estimate: approvedEstimate._id,
              estimateNumber: approvedEstimate.estimateNumber,
              estimateRevision: approvedEstimate.currentRevision,
              customer: job.customer,
              vehicle: job.vehicle,
              businessSnapshot: {
                businessName: settings.businessName || 'USA Auto Care',
                location: settings.location || 'Alawwa, Sri Lanka',
                address: settings.streetAddress || '',
                phone: settings.phone || '',
                taxRegistrationNumber: settings.taxRegistrationNumber || '',
                invoiceFooter: settings.invoiceFooter || '',
              },
              parts: totals.parts,
              labour: totals.labour,
              partsSubtotalMinor: totals.partsSubtotalMinor,
              labourSubtotalMinor: totals.labourSubtotalMinor,
              discountMinor: totals.discountMinor,
              taxEnabled: totals.taxEnabled,
              taxRatePercent: totals.taxRatePercent,
              taxAmountMinor: totals.taxAmountMinor,
              grandTotalMinor: totals.grandTotalMinor,
              paidMinor: 0,
              balanceDueMinor: totals.grandTotalMinor,
              estimatedPartsCostMinor: totals.estimatedPartsCostMinor,
              directLabourCostMinor: totals.directLabourCostMinor,
              estimatedGrossProfitMinor: totals.estimatedGrossProfitMinor,
              status: 'Unpaid',
              paymentTerms: parsed.paymentTerms || 'Due on receipt',
              notes: parsed.notes || '',
              issuedBy: req.user._id,
            },
          ],
          { session }
        );

        await AuditLog.create(
          [
            {
              action: 'INVOICE_ISSUED',
              entityType: 'Invoice',
              entityId: String(invoice._id),
              summary: `Issued Invoice ${invoiceNumber} from ${approvedEstimate.estimateNumber} Rev ${approvedEstimate.currentRevision} for Job ${job.jobNumber}`,
              metadata: {
                invoiceNumber,
                jobNumber: job.jobNumber,
                estimateNumber: approvedEstimate.estimateNumber,
                estimateRevision: approvedEstimate.currentRevision,
                grandTotalMinor: invoice.grandTotalMinor,
              },
              performedBy: req.user._id,
              performedByName: req.user.name,
              performedByRole: req.user.role,
            },
          ],
          { session }
        );

        return invoice;
      });

      emitDomainEvent('invoices', 'created', { id: createdInvoice._id }, 'scope:financial');
      emitDomainEvent('dashboard', 'refresh', {});
      return res.status(201).json({ data: createdInvoice });
    } catch (err) {
      return next(err);
    }
  }
);

// Record payment (supports Cash, Bank Transfer, Card record, Customer Deposit, or Deposit Allocation)
// Enforces idempotencyKey to prevent duplicate submissions
router.post(
  '/payments',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_INVOICES_PAYMENTS'),
  async (req, res, next) => {
    try {
      const parsed = recordPaymentSchema.parse(req.body);
      const amountMinor = toMinorUnits(parsed.amountLkr);

      // Idempotency check before starting transaction
      const existingByKey = await Payment.findOne({ idempotencyKey: parsed.idempotencyKey.trim() }).lean();
      if (existingByKey) {
        return res.status(200).json({
          data: existingByKey,
          idempotentReplay: true,
          message: 'Duplicate submission prevented via idempotency key.',
        });
      }

      const result = await withTransaction(async (session) => {
        const paymentNumber = await Counter.nextSequence('PAYMENT', 'PAY', 5, session);

        if (parsed.paymentType === 'CUSTOMER_DEPOSIT') {
          const customer = await Customer.findByIdAndUpdate(
            parsed.customerId,
            { $inc: { depositBalanceMinor: amountMinor } },
            { new: true, session }
          );
          if (!customer) throw new Error('Customer not found');

          const [payment] = await Payment.create(
            [
              {
                paymentNumber,
                idempotencyKey: parsed.idempotencyKey.trim(),
                invoice: null,
                customer: customer._id,
                paymentType: 'CUSTOMER_DEPOSIT',
                method: parsed.method,
                amountMinor,
                referenceNumber: parsed.referenceNumber || '',
                notes: parsed.notes || 'Customer advance deposit',
                receivedBy: req.user._id,
              },
            ],
            { session }
          );

          return { payment, invoice: null };
        }

        // Invoice Payment or Deposit Allocation
        if (!parsed.invoiceId) {
          throw new Error('Invoice ID is required for invoice payments');
        }
        const invoice = await Invoice.findById(parsed.invoiceId).session(session);
        if (!invoice) throw new Error('Invoice not found');

        const existingPayments = await Payment.find({ invoice: invoice._id }).session(session);

        validatePaymentSubmission({
          invoice,
          existingPayments,
          amountMinor,
          idempotencyKey: parsed.idempotencyKey,
          method: parsed.method,
        });

        if (parsed.paymentType === 'DEPOSIT_ALLOCATION' || parsed.method === 'Deposit Allocation') {
          // Atomically deduct from customer's unallocated deposit balance exactly once
          const customer = await Customer.findOneAndUpdate(
            { _id: invoice.customer, depositBalanceMinor: { $gte: amountMinor } },
            { $inc: { depositBalanceMinor: -amountMinor } },
            { new: true, session }
          );
          if (!customer) {
            throw new Error('Insufficient customer deposit balance for this allocation');
          }
        }

        const [payment] = await Payment.create(
          [
            {
              paymentNumber,
              idempotencyKey: parsed.idempotencyKey.trim(),
              invoice: invoice._id,
              customer: invoice.customer,
              paymentType: parsed.paymentType,
              method: parsed.method,
              amountMinor,
              referenceNumber: parsed.referenceNumber || '',
              notes: parsed.notes || '',
              receivedBy: req.user._id,
            },
          ],
          { session }
        );

        const updatedPayments = [...existingPayments, payment];
        const derived = deriveInvoiceBalanceAndStatus(
          invoice.grandTotalMinor,
          updatedPayments,
          invoice.isVoided
        );

        invoice.paidMinor = derived.paidMinor;
        invoice.balanceDueMinor = derived.balanceDueMinor;
        invoice.status = derived.status;
        await invoice.save({ session });

        return { payment, invoice };
      });

      emitDomainEvent('payments', 'created', { id: result.payment._id }, 'scope:financial');
      emitDomainEvent('invoices', 'updated', { id: result.invoice?._id }, 'scope:financial');
      emitDomainEvent('dashboard', 'refresh', {});

      return res.status(201).json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

// Audited Invoice Void (no hard deletion of issued invoices)
router.post(
  '/invoices/:id/void',
  requireAuth,
  verifyCsrf,
  requirePermission('VOID_INVOICE_OR_REVERSE_PAYMENT'),
  async (req, res, next) => {
    try {
      const reason = (req.body.reason || '').trim();
      if (reason.length < 4) {
        return res.status(400).json({ message: 'A clear audit reason is required to void an invoice.' });
      }

      const invoice = await withTransaction(async (session) => {
        const inv = await Invoice.findById(req.params.id).session(session);
        if (!inv) throw new Error('Invoice not found');
        if (inv.isVoided) throw new Error('Invoice is already voided');

        const activePayments = await Payment.countDocuments({
          invoice: inv._id,
          isReversed: false,
        }).session(session);

        if (activePayments > 0) {
          throw new Error('Reverse all active payments on this invoice before voiding it.');
        }

        inv.isVoided = true;
        inv.status = 'Voided';
        inv.balanceDueMinor = 0;
        inv.voidReason = reason;
        inv.voidedAt = new Date();
        inv.voidedBy = req.user._id;
        await inv.save({ session });

        await AuditLog.create(
          [
            {
              action: 'INVOICE_VOIDED',
              entityType: 'Invoice',
              entityId: String(inv._id),
              summary: `Voided Invoice ${inv.invoiceNumber}: ${reason}`,
              metadata: { invoiceNumber: inv.invoiceNumber, reason },
              performedBy: req.user._id,
              performedByName: req.user.name,
              performedByRole: req.user.role,
            },
          ],
          { session }
        );

        return inv;
      });

      emitDomainEvent('invoices', 'voided', { id: invoice._id }, 'scope:financial');
      emitDomainEvent('dashboard', 'refresh', {});
      return res.json({ data: invoice });
    } catch (err) {
      return next(err);
    }
  }
);

// Audited Payment Reversal (no hard deletion of payment records)
router.post(
  '/payments/:id/reverse',
  requireAuth,
  verifyCsrf,
  requirePermission('VOID_INVOICE_OR_REVERSE_PAYMENT'),
  async (req, res, next) => {
    try {
      const reason = (req.body.reason || '').trim();
      if (reason.length < 4) {
        return res.status(400).json({ message: 'A clear audit reason is required to reverse a payment.' });
      }

      const result = await withTransaction(async (session) => {
        const payment = await Payment.findById(req.params.id).session(session);
        if (!payment) throw new Error('Payment record not found');
        if (payment.isReversed) throw new Error('Payment has already been reversed');

        payment.isReversed = true;
        payment.reversalReason = reason;
        payment.reversedAt = new Date();
        payment.reversedBy = req.user._id;
        await payment.save({ session });

        let invoice = null;
        if (payment.invoice) {
          invoice = await Invoice.findById(payment.invoice).session(session);
          const allPayments = await Payment.find({ invoice: invoice._id }).session(session);
          const derived = deriveInvoiceBalanceAndStatus(
            invoice.grandTotalMinor,
            allPayments,
            invoice.isVoided
          );
          invoice.paidMinor = derived.paidMinor;
          invoice.balanceDueMinor = derived.balanceDueMinor;
          invoice.status = derived.status;
          await invoice.save({ session });
        }

        await AuditLog.create(
          [
            {
              action: 'PAYMENT_REVERSED',
              entityType: 'Payment',
              entityId: String(payment._id),
              summary: `Reversed Payment ${payment.paymentNumber}: ${reason}`,
              metadata: { paymentNumber: payment.paymentNumber, amountMinor: payment.amountMinor, reason },
              performedBy: req.user._id,
              performedByName: req.user.name,
              performedByRole: req.user.role,
            },
          ],
          { session }
        );

        return { payment, invoice };
      });

      emitDomainEvent('payments', 'reversed', { id: result.payment._id }, 'scope:financial');
      emitDomainEvent('invoices', 'updated', { id: result.invoice?._id }, 'scope:financial');
      emitDomainEvent('dashboard', 'refresh', {});
      return res.json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/payments', requireAuth, requirePermission('MANAGE_INVOICES_PAYMENTS'), async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate('customer', 'name phone')
      .populate('invoice', 'invoiceNumber grandTotalMinor status')
      .populate('receivedBy', 'name role')
      .sort({ paidAt: -1 })
      .limit(100)
      .lean();
    return res.json({ data: payments });
  } catch (err) {
    return next(err);
  }
});

export default router;
