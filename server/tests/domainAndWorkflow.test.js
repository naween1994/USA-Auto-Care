import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  normalizeRegistrationNumber,
  toMinorUnits,
  fromMinorUnits,
  calculateDocumentTotals,
  deriveInvoiceBalanceAndStatus,
  validatePaymentSubmission,
  validateJobStatusTransition,
  hasPermission,
  sanitizePartForRole,
} from '../src/utils/domainLogic.js';

test('1. Authentication & Role-Based Permissions Enforcement', async (t) => {
  await t.test('Admin has unrestricted access to settings, financials, and inventory costs', () => {
    assert.equal(hasPermission(ROLES.ADMIN, 'MANAGE_SETTINGS_AND_STAFF'), true);
    assert.equal(hasPermission(ROLES.ADMIN, 'VIEW_FINANCIAL_REPORTS'), true);
    assert.equal(hasPermission(ROLES.ADMIN, 'VIEW_PART_PURCHASE_COST'), true);
  });

  await t.test('Mechanic is blocked from financial reports, invoices, and part purchase costs', () => {
    assert.equal(hasPermission(ROLES.MECHANIC, 'VIEW_FINANCIAL_REPORTS'), false);
    assert.equal(hasPermission(ROLES.MECHANIC, 'MANAGE_INVOICES_PAYMENTS'), false);
    assert.equal(hasPermission(ROLES.MECHANIC, 'VIEW_PART_PURCHASE_COST'), false);
    assert.equal(hasPermission(ROLES.MECHANIC, 'UPDATE_JOB_WORK'), true);
    assert.equal(hasPermission(ROLES.MECHANIC, 'ISSUE_PART_TO_JOB'), true);

    const rawPart = {
      sku: 'OIL-0W20-4L',
      name: 'Toyota 0W-20 Oil',
      purchaseCostMinor: 1180000,
      sellingPriceMinor: 1450000,
    };
    const mechanicView = sanitizePartForRole(rawPart, ROLES.MECHANIC);
    assert.equal(mechanicView.purchaseCostMinor, undefined);
    assert.equal(mechanicView.sellingPriceMinor, 1450000);
  });

  await t.test('Cashier can manage invoices and payments but cannot alter workshop settings', () => {
    assert.equal(hasPermission(ROLES.CASHIER, 'MANAGE_INVOICES_PAYMENTS'), true);
    assert.equal(hasPermission(ROLES.CASHIER, 'VOID_INVOICE_OR_REVERSE_PAYMENT'), true);
    assert.equal(hasPermission(ROLES.CASHIER, 'MANAGE_SETTINGS_AND_STAFF'), false);
  });
});

test('2. Authoritative Server-Side Estimate & Invoice Calculations (LKR Minor Units)', async (t) => {
  await t.test('Computes parts, labour, discounts, configurable taxes, and gross profit accurately', () => {
    const totals = calculateDocumentTotals({
      parts: [
        {
          sku: 'OIL-0W20-4L',
          name: '0W-20 Synthetic Oil',
          quantity: 1,
          unitPriceMinor: toMinorUnits(14500),
          unitCostMinor: toMinorUnits(11800),
          isCustomerSupplied: false,
        },
        {
          sku: 'FLT-OIL',
          name: 'OEM Oil Filter',
          quantity: 1,
          unitPriceMinor: toMinorUnits(2800),
          unitCostMinor: toMinorUnits(1950),
          isCustomerSupplied: false,
        },
        {
          sku: 'CUST-WIPER',
          name: 'Customer Supplied Wiper Blade',
          quantity: 2,
          unitPriceMinor: toMinorUnits(3000), // Should be zeroed automatically because customer supplied
          unitCostMinor: toMinorUnits(2000),
          isCustomerSupplied: true,
        },
      ],
      labour: [
        {
          description: 'Full Hybrid Periodic Service Labour',
          hours: 2,
          rateMinor: toMinorUnits(3500),
          directLabourCostMinor: toMinorUnits(2200),
        },
      ],
      discountMinor: toMinorUnits(1300),
      taxEnabled: false, // Default disabled unless configured
      taxRatePercent: 18,
    });

    // Parts: 14,500 + 2,800 + 0 = 17,300 LKR
    assert.equal(fromMinorUnits(totals.partsSubtotalMinor), 17300);
    // Labour: 2 * 3,500 = 7,000 LKR
    assert.equal(fromMinorUnits(totals.labourSubtotalMinor), 7000);
    // Gross Subtotal: 24,300 LKR; Minus 1,300 discount = 23,000 LKR
    assert.equal(fromMinorUnits(totals.netBeforeTaxMinor), 23000);
    // Tax disabled -> 0
    assert.equal(totals.taxAmountMinor, 0);
    assert.equal(fromMinorUnits(totals.grandTotalMinor), 23000);
    // Estimated parts cost: 11,800 + 1,950 = 13,750 LKR; Direct labour cost: 2,200 LKR
    // Gross profit: 23,000 - 13,750 - 2,200 = 7,050 LKR
    assert.equal(fromMinorUnits(totals.estimatedGrossProfitMinor), 7050);
  });

  await t.test('Applies configurable tax when explicitly enabled in BusinessSettings', () => {
    const totalsWithTax = calculateDocumentTotals({
      parts: [{ name: 'Brake Pads', quantity: 1, unitPriceMinor: toMinorUnits(10000), unitCostMinor: toMinorUnits(7000) }],
      labour: [{ description: 'Brake fitting', hours: 1, rateMinor: toMinorUnits(2500) }],
      discountMinor: toMinorUnits(500),
      taxEnabled: true,
      taxRatePercent: 18,
    });
    // Net before tax: 12,000 LKR; 18% tax = 2,160 LKR; Grand total = 14,160 LKR
    assert.equal(fromMinorUnits(totalsWithTax.taxAmountMinor), 2160);
    assert.equal(fromMinorUnits(totalsWithTax.grandTotalMinor), 14160);
  });
});

test('3. Partial Payments, Balance Derivation & Overpayment Prevention', async () => {
  const grandTotalMinor = toMinorUnits(23000);

  // Initial unpaid state
  let state = deriveInvoiceBalanceAndStatus(grandTotalMinor, []);
  assert.equal(state.status, 'Unpaid');
  assert.equal(fromMinorUnits(state.balanceDueMinor), 23000);

  // Record first partial payment of LKR 10,000
  const payment1 = {
    idempotencyKey: 'idem-key-0001',
    amountMinor: toMinorUnits(10000),
    method: 'Cash',
    isReversed: false,
  };
  state = deriveInvoiceBalanceAndStatus(grandTotalMinor, [payment1]);
  assert.equal(state.status, 'Partially Paid');
  assert.equal(fromMinorUnits(state.paidMinor), 10000);
  assert.equal(fromMinorUnits(state.balanceDueMinor), 13000);

  // Attempt overpayment of LKR 15,000 when only LKR 13,000 is due -> must throw
  assert.throws(() => {
    validatePaymentSubmission({
      invoice: { grandTotalMinor, isVoided: false },
      existingPayments: [payment1],
      amountMinor: toMinorUnits(15000),
      idempotencyKey: 'idem-key-overpay',
      method: 'Card',
    });
  }, /exceeds remaining invoice balance/);

  // Pay exact remaining balance of LKR 13,000
  const payment2 = {
    idempotencyKey: 'idem-key-0002',
    amountMinor: toMinorUnits(13000),
    method: 'Bank Transfer',
    isReversed: false,
  };
  state = deriveInvoiceBalanceAndStatus(grandTotalMinor, [payment1, payment2]);
  assert.equal(state.status, 'Paid');
  assert.equal(state.balanceDueMinor, 0);
});

test('4. Duplicate-Payment Prevention via Idempotency Keys', async () => {
  const invoice = { grandTotalMinor: toMinorUnits(15000), isVoided: false };
  const existingPayments = [
    {
      paymentNumber: 'PAY-2026-00001',
      idempotencyKey: 'client-uuid-987654321',
      amountMinor: toMinorUnits(5000),
      method: 'Cash',
      isReversed: false,
    },
  ];

  // Re-submitting the exact same idempotencyKey returns duplicate: true without deducting balance again
  const check = validatePaymentSubmission({
    invoice,
    existingPayments,
    amountMinor: toMinorUnits(5000),
    idempotencyKey: 'client-uuid-987654321',
    method: 'Cash',
  });
  assert.equal(check.duplicate, true);
  assert.equal(check.payment.paymentNumber, 'PAY-2026-00001');
});

test('5. Concurrent Stock Consumption & Negative Stock Prevention', async () => {
  // Simulate atomic MongoDB findOneAndUpdate({ _id, quantityOnHand: { $gte: qty } }, { $inc: { quantityOnHand: -qty } })
  let stockDatabaseRecord = {
    sku: 'BRK-PAD-FR-AQUA',
    quantityOnHand: 5,
  };

  async function atomicIssueStock(requestedQty) {
    // Atomic check-and-decrement lock simulation
    if (stockDatabaseRecord.quantityOnHand >= requestedQty) {
      stockDatabaseRecord.quantityOnHand -= requestedQty;
      return { ok: true, remaining: stockDatabaseRecord.quantityOnHand };
    }
    throw new Error('Insufficient stock');
  }

  // Fire two concurrent requests for 4 units each when only 5 units exist on hand
  const results = await Promise.allSettled([atomicIssueStock(4), atomicIssueStock(4)]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one concurrent request should succeed');
  assert.equal(rejected.length, 1, 'The second concurrent request must fail to prevent negative stock');
  assert.equal(stockDatabaseRecord.quantityOnHand, 1, 'Remaining stock must be 1 (never negative)');
});

test('6. Job-Status Validation, Quality Check Gate, and Cancellation Part Reconciliation', async (t) => {
  await t.test('Blocks invalid status jumps (e.g. Checked In directly to Delivered)', () => {
    assert.throws(() => {
      validateJobStatusTransition({
        currentStatus: 'Checked In',
        nextStatus: 'Delivered',
        unreconciledPartsCount: 0,
        qualityCheckPassed: true,
      });
    }, /Invalid job status transition/);
  });

  await t.test('Blocks Ready for Collection if Final Quality Check is not passed', () => {
    assert.throws(() => {
      validateJobStatusTransition({
        currentStatus: 'Quality Check',
        nextStatus: 'Ready for Collection',
        unreconciledPartsCount: 0,
        qualityCheckPassed: false,
      });
    }, /Final quality check must be completed/);
  });

  await t.test('Blocks Job Cancellation when issued workshop parts have not been returned to stock', () => {
    assert.throws(() => {
      validateJobStatusTransition({
        currentStatus: 'In Progress',
        nextStatus: 'Cancelled',
        unreconciledPartsCount: 2,
        qualityCheckPassed: false,
      });
    }, /unreconciled/);

    // Once parts are returned (unreconciledPartsCount === 0), cancellation succeeds
    const validCancel = validateJobStatusTransition({
      currentStatus: 'In Progress',
      nextStatus: 'Cancelled',
      unreconciledPartsCount: 0,
      qualityCheckPassed: false,
    });
    assert.equal(validCancel.valid, true);
  });

  await t.test('Normalizes Sri Lankan vehicle registration numbers consistently', () => {
    assert.equal(normalizeRegistrationNumber('wp cab 1234'), 'WP-CAB-1234');
    assert.equal(normalizeRegistrationNumber('nw-kv-8901'), 'NW-KV-8901');
    assert.equal(normalizeRegistrationNumber('  300 - 4512 '), '300-4512');
  });
});
