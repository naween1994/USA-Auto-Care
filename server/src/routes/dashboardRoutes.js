import express from 'express';
import { Appointment } from '../models/Appointment.js';
import { JobCard } from '../models/JobCard.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { Part } from '../models/Part.js';
import { AuditLog } from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { hasPermission } from '../utils/domainLogic.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    // Compute start and end of today in Asia/Colombo (+05:30)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const activeWorkshopStatuses = [
      'Checked In',
      'Inspecting',
      'Awaiting Approval',
      'Waiting for Parts',
      'In Progress',
      'Quality Check',
      'Ready to Collect',
      'Ready for Collection',
    ];

    const [
      todaysAppointmentsCount,
      vehiclesInWorkshopCount,
      jobsAwaitingApprovalCount,
      jobsWaitingForPartsCount,
      vehiclesReadyForCollectionCount,
      lowStockParts,
      recentActivity,
    ] = await Promise.all([
      Appointment.countDocuments({
        isArchived: { $ne: true },
        scheduledAt: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['Cancelled'] },
      }),
      JobCard.countDocuments({ isArchived: { $ne: true }, status: { $in: activeWorkshopStatuses } }),
      JobCard.countDocuments({ isArchived: { $ne: true }, status: 'Awaiting Approval' }),
      JobCard.countDocuments({ isArchived: { $ne: true }, status: 'Waiting for Parts' }),
      JobCard.countDocuments({
        isArchived: { $ne: true },
        status: { $in: ['Ready to Collect', 'Ready for Collection'] },
      }),
      Part.find({
        isActive: true,
        isArchived: { $ne: true },
        $expr: { $lte: ['$quantityOnHand', '$reorderThreshold'] },
      })
        .select('sku name category quantityOnHand reorderThreshold unit')
        .limit(15)
        .lean(),
      AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    const canSeeFinancials = hasPermission(req.user.role, 'VIEW_DASHBOARD_FINANCIALS');
    let todaysPaymentsMinor = null;
    let outstandingInvoiceBalanceMinor = null;
    let collectionsSeries = [];

    if (canSeeFinancials) {
      const [todayPaymentsAgg, outstandingAgg] = await Promise.all([
        Payment.aggregate([
          {
            $match: {
              isReversed: false,
              paidAt: { $gte: startOfDay, $lte: endOfDay },
            },
          },
          { $group: { _id: null, total: { $sum: '$amountMinor' } } },
        ]),
        Invoice.aggregate([
          {
            $match: {
              isVoided: false,
              status: { $in: ['Unpaid', 'Partially Paid'] },
            },
          },
          { $group: { _id: null, total: { $sum: '$balanceDueMinor' } } },
        ]),
      ]);

      todaysPaymentsMinor = todayPaymentsAgg[0]?.total || 0;
      outstandingInvoiceBalanceMinor = outstandingAgg[0]?.total || 0;

      // Last 7 days invoiced revenue vs cash collections chart
      const sevenDaysAgo = new Date(startOfDay);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const [invoicesByDay, paymentsByDay] = await Promise.all([
        Invoice.aggregate([
          { $match: { isVoided: false, createdAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Colombo' } },
              invoicedMinor: { $sum: '$grandTotalMinor' },
            },
          },
        ]),
        Payment.aggregate([
          { $match: { isReversed: false, paidAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Colombo' } },
              collectedMinor: { $sum: '$amountMinor' },
            },
          },
        ]),
      ]);

      const invMap = Object.fromEntries(invoicesByDay.map((d) => [d._id, d.invoicedMinor]));
      const payMap = Object.fromEntries(paymentsByDay.map((d) => [d._id, d.collectedMinor]));

      for (let i = 6; i >= 0; i--) {
        const d = new Date(startOfDay);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        collectionsSeries.push({
          date: key,
          invoicedMinor: invMap[key] || 0,
          collectedMinor: payMap[key] || 0,
        });
      }
    }

    return res.json({
      data: {
        todaysAppointmentsCount,
        vehiclesInWorkshopCount,
        jobsAwaitingApprovalCount,
        jobsWaitingForPartsCount,
        vehiclesReadyForCollectionCount,
        todaysPaymentsMinor,
        outstandingInvoiceBalanceMinor,
        lowStockPartsCount: lowStockParts.length,
        lowStockParts,
        collectionsSeries,
        recentActivity,
      },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
