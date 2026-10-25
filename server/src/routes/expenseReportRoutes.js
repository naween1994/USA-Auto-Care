import express from 'express';
import { Expense } from '../models/Expense.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { JobCard } from '../models/JobCard.js';
import { Part } from '../models/Part.js';
import { StockMovement } from '../models/StockMovement.js';
import { expenseSchema } from '../validators/schemas.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { toMinorUnits, fromMinorUnits } from '../utils/domainLogic.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

router.get('/expenses', requireAuth, requirePermission('MANAGE_EXPENSES'), async (req, res, next) => {
  try {
    const query = {};
    if (req.query.from || req.query.to) {
      query.incurredOn = {};
      if (req.query.from) query.incurredOn.$gte = new Date(req.query.from);
      if (req.query.to) query.incurredOn.$lte = new Date(`${req.query.to}T23:59:59.999+05:30`);
    }
    const expenses = await Expense.find(query)
      .populate('recordedBy', 'name role')
      .sort({ incurredOn: -1 })
      .lean();
    return res.json({ data: expenses });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/expenses',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_EXPENSES'),
  async (req, res, next) => {
    try {
      const parsed = expenseSchema.parse(req.body);
      const created = await Expense.create({
        category: parsed.category,
        amountMinor: toMinorUnits(parsed.amountLkr),
        incurredOn: new Date(parsed.incurredOn),
        vendorName: parsed.vendorName || '',
        notes: parsed.notes,
        recordedBy: req.user._id,
      });

      emitDomainEvent('expenses', 'created', { id: created._id }, 'scope:financial');
      return res.status(201).json({ data: created });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/reports/summary', requireAuth, requirePermission('VIEW_FINANCIAL_REPORTS'), async (req, res, next) => {
  try {
    const fromDate = req.query.from ? new Date(`${req.query.from}T00:00:00.000+05:30`) : new Date(new Date().setDate(new Date().getDate() - 30));
    const toDate = req.query.to ? new Date(`${req.query.to}T23:59:59.999+05:30`) : new Date();

    const [
      invoices,
      payments,
      expenses,
      jobsByStatus,
      commonlyUsedParts,
      lowStockParts,
    ] = await Promise.all([
      Invoice.find({
        isVoided: false,
        createdAt: { $gte: fromDate, $lte: toDate },
      }).lean(),
      Payment.find({
        isReversed: false,
        paidAt: { $gte: fromDate, $lte: toDate },
      }).lean(),
      Expense.find({
        incurredOn: { $gte: fromDate, $lte: toDate },
      }).lean(),
      JobCard.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      StockMovement.aggregate([
        {
          $match: {
            movementType: 'JOB_ISSUE',
            createdAt: { $gte: fromDate, $lte: toDate },
          },
        },
        {
          $group: {
            _id: '$part',
            totalIssuedQty: { $sum: { $abs: '$quantityDelta' } },
          },
        },
        { $sort: { totalIssuedQty: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'parts',
            localField: '_id',
            foreignField: '_id',
            as: 'partInfo',
          },
        },
        { $unwind: '$partInfo' },
      ]),
      Part.find({
        isActive: true,
        $expr: { $lte: ['$quantityOnHand', '$reorderThreshold'] },
      }).lean(),
    ]);

    const invoicedSalesMinor = invoices.reduce((s, i) => s + (i.grandTotalMinor || 0), 0);
    const outstandingBalancesMinor = invoices.reduce((s, i) => s + (i.balanceDueMinor || 0), 0);
    const estimatedPartsCostMinor = invoices.reduce((s, i) => s + (i.estimatedPartsCostMinor || 0), 0);
    const directLabourCostMinor = invoices.reduce((s, i) => s + (i.directLabourCostMinor || 0), 0);
    const estimatedJobGrossProfitMinor = invoices.reduce((s, i) => s + (i.estimatedGrossProfitMinor || 0), 0);
    const paymentsReceivedMinor = payments.reduce((s, p) => s + (p.amountMinor || 0), 0);
    const totalExpensesMinor = expenses.reduce((s, e) => s + (e.amountMinor || 0), 0);

    return res.json({
      data: {
        period: { from: fromDate.toISOString(), to: toDate.toISOString() },
        metrics: {
          invoicedSalesMinor,
          paymentsReceivedMinor,
          outstandingBalancesMinor,
          totalExpensesMinor,
          estimatedPartsCostMinor,
          directLabourCostMinor,
          estimatedJobGrossProfitMinor,
          netOperatingSurplusMinor: estimatedJobGrossProfitMinor - totalExpensesMinor,
        },
        jobsByStatus,
        commonlyUsedParts: commonlyUsedParts.map((item) => ({
          partId: item._id,
          sku: item.partInfo.sku,
          name: item.partInfo.name,
          totalIssuedQty: item.totalIssuedQty,
        })),
        lowStockParts,
        invoicesCount: invoices.length,
        paymentsCount: payments.length,
        expensesCount: expenses.length,
      },
    });
  } catch (err) {
    return next(err);
  }
});

// CSV Export for Financial & Operational Reports
router.get('/reports/export-csv', requireAuth, requirePermission('VIEW_FINANCIAL_REPORTS'), async (req, res, next) => {
  try {
    const type = req.query.type || 'invoices';
    let csvRows = [];

    if (type === 'invoices') {
      const invoices = await Invoice.find({ isVoided: false })
        .populate('customer', 'name')
        .populate('vehicle', 'registrationNumber')
        .sort({ createdAt: -1 })
        .lean();

      csvRows.push([
        'Invoice Number',
        'Date',
        'Customer',
        'Vehicle Reg',
        'Status',
        'Total (LKR)',
        'Paid (LKR)',
        'Balance Due (LKR)',
        'Est. Gross Profit (LKR)',
      ]);
      for (const inv of invoices) {
        csvRows.push([
          inv.invoiceNumber,
          new Date(inv.createdAt).toISOString().slice(0, 10),
          `"${(inv.customer?.name || '').replace(/"/g, '""')}"`,
          inv.vehicle?.registrationNumber || '',
          inv.status,
          fromMinorUnits(inv.grandTotalMinor).toFixed(2),
          fromMinorUnits(inv.paidMinor).toFixed(2),
          fromMinorUnits(inv.balanceDueMinor).toFixed(2),
          fromMinorUnits(inv.estimatedGrossProfitMinor).toFixed(2),
        ]);
      }
    } else if (type === 'expenses') {
      const expenses = await Expense.find().sort({ incurredOn: -1 }).lean();
      csvRows.push(['Date', 'Category', 'Vendor', 'Amount (LKR)', 'Notes']);
      for (const exp of expenses) {
        csvRows.push([
          new Date(exp.incurredOn).toISOString().slice(0, 10),
          exp.category,
          `"${(exp.vendorName || '').replace(/"/g, '""')}"`,
          fromMinorUnits(exp.amountMinor).toFixed(2),
          `"${(exp.notes || '').replace(/"/g, '""')}"`,
        ]);
      }
    }

    const csvString = csvRows.map((r) => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="usa-auto-care-${type}.csv"`);
    return res.send(csvString);
  } catch (err) {
    return next(err);
  }
});

export default router;
