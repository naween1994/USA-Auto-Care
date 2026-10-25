/**
 * Core Domain & Financial Logic for USA Auto Care (Alawwa, Sri Lanka)
 * - Uses integer minor units (LKR cents / 1/100th LKR) to eliminate floating-point drift
 * - Enforces Sri Lankan registration normalization
 * - Enforces valid Job Card state transitions
 * - Enforces role-based permissions
 * - Implements atomic concurrent stock reservation & idempotency simulation/validation
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  RECEPTIONIST: 'receptionist',
  MECHANIC: 'mechanic',
  CASHIER: 'cashier',
});

export const JOB_STATUSES = Object.freeze([
  'Checked In',
  'Inspecting',
  'Awaiting Approval',
  'Waiting for Parts',
  'In Progress',
  'Quality Check',
  'Ready to Collect',
  'Ready for Collection',
  'Delivered',
  'Cancelled',
]);

export const ALLOWED_JOB_TRANSITIONS = Object.freeze({
  'Checked In': ['Inspecting', 'Awaiting Approval', 'In Progress', 'Cancelled'],
  'Inspecting': ['Awaiting Approval', 'Waiting for Parts', 'In Progress', 'Cancelled'],
  'Awaiting Approval': ['Inspecting', 'Waiting for Parts', 'In Progress', 'Cancelled'],
  'Waiting for Parts': ['In Progress', 'Awaiting Approval', 'Cancelled'],
  'In Progress': ['Waiting for Parts', 'Quality Check', 'Awaiting Approval', 'Cancelled'],
  'Quality Check': ['In Progress', 'Ready to Collect'],
  'Ready to Collect': ['Delivered', 'Quality Check'],
  'Ready for Collection': ['Delivered', 'Quality Check'],
  'Delivered': [],
  'Cancelled': [],
});

/**
 * Normalize Sri Lankan vehicle registration numbers for reliable duplicate prevention & search.
 * Examples:
 *  "wp cab - 1234" -> "WP-CAB-1234"
 *  "NW KV 4590"    -> "NW-KV-4590"
 *  "300 - 4512"    -> "300-4512"
 */
export function normalizeRegistrationNumber(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // Separate letter prefix and trailing digits if joined (e.g., CAB1234 -> CAB-1234)
  return cleaned.replace(/([A-Z])([0-9]{4})$/, '$1-$2');
}

/**
 * Convert decimal LKR input (number or string) to integer minor units (cents).
 */
export function toMinorUnits(amountLkr) {
  if (amountLkr === null || amountLkr === undefined || amountLkr === '') return 0;
  const num = Number(amountLkr);
  if (!Number.isFinite(num)) {
    throw new Error('Invalid monetary amount');
  }
  return Math.round(num * 100);
}

/**
 * Convert integer minor units (cents) to 2-decimal LKR number.
 */
export function fromMinorUnits(minorUnits) {
  return Number((Math.round(Number(minorUnits || 0)) / 100).toFixed(2));
}

/**
 * Format minor units as LKR currency string (e.g. "LKR 14,500.00").
 */
export function formatLkrFromMinor(minorUnits) {
  const value = fromMinorUnits(minorUnits);
  return `LKR ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calculate authoritative Estimate / Invoice totals on the server using integer minor units.
 *
 * @param {Object} input
 * @param {Array} input.parts - [{ quantity, unitPriceMinor, unitCostMinor, isCustomerSupplied }]
 * @param {Array} input.labour - [{ hours, rateMinor, fixedAmountMinor, directLabourCostMinor }]
 * @param {number} input.discountMinor - Fixed discount in minor units
 * @param {boolean} input.taxEnabled - Whether tax is enabled in BusinessSettings / document
 * @param {number} input.taxRatePercent - Configurable tax percentage (e.g. 0 or 18)
 */
export function calculateDocumentTotals({
  parts = [],
  labour = [],
  discountMinor = 0,
  taxEnabled = false,
  taxRatePercent = 0,
}) {
  if (discountMinor < 0) {
    throw new Error('Discount cannot be negative');
  }

  let partsSubtotalMinor = 0;
  let estimatedPartsCostMinor = 0;

  const normalizedParts = parts.map((item) => {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) {
      throw new Error('Part quantity must be greater than zero');
    }
    const isCustomerSupplied = Boolean(item.isCustomerSupplied);
    const unitPriceMinor = isCustomerSupplied ? 0 : Math.round(Number(item.unitPriceMinor || 0));
    const unitCostMinor = isCustomerSupplied ? 0 : Math.round(Number(item.unitCostMinor || 0));
    if (unitPriceMinor < 0 || unitCostMinor < 0) {
      throw new Error('Part unit price and cost cannot be negative');
    }
    const lineTotalMinor = Math.round(qty * unitPriceMinor);
    const lineCostMinor = Math.round(qty * unitCostMinor);
    partsSubtotalMinor += lineTotalMinor;
    estimatedPartsCostMinor += lineCostMinor;

    return {
      ...item,
      quantity: qty,
      isCustomerSupplied,
      unitPriceMinor,
      unitCostMinor,
      lineTotalMinor,
      lineCostMinor,
    };
  });

  let labourSubtotalMinor = 0;
  let directLabourCostMinor = 0;

  const normalizedLabour = labour.map((item) => {
    const hours = Number(item.hours ?? 1);
    const rateMinor = Math.round(Number(item.rateMinor ?? item.amountMinor ?? 0));
    if (hours <= 0 || rateMinor < 0) {
      throw new Error('Labour hours must be positive and rate cannot be negative');
    }
    const lineTotalMinor =
      item.fixedAmountMinor !== undefined
        ? Math.round(Number(item.fixedAmountMinor))
        : Math.round(hours * rateMinor);
    const lineDirectCostMinor = Math.round(Number(item.directLabourCostMinor || 0));

    labourSubtotalMinor += lineTotalMinor;
    directLabourCostMinor += lineDirectCostMinor;

    return {
      ...item,
      hours,
      rateMinor,
      lineTotalMinor,
      directLabourCostMinor: lineDirectCostMinor,
    };
  });

  const grossSubtotalMinor = partsSubtotalMinor + labourSubtotalMinor;
  if (discountMinor > grossSubtotalMinor) {
    throw new Error('Discount cannot exceed subtotal');
  }

  const netBeforeTaxMinor = grossSubtotalMinor - Math.round(discountMinor);
  const effectiveTaxRate = taxEnabled && Number(taxRatePercent) > 0 ? Number(taxRatePercent) : 0;
  const taxAmountMinor = Math.round((netBeforeTaxMinor * effectiveTaxRate) / 100);
  const grandTotalMinor = netBeforeTaxMinor + taxAmountMinor;
  const estimatedGrossProfitMinor =
    netBeforeTaxMinor - estimatedPartsCostMinor - directLabourCostMinor;

  return {
    parts: normalizedParts,
    labour: normalizedLabour,
    partsSubtotalMinor,
    labourSubtotalMinor,
    grossSubtotalMinor,
    discountMinor: Math.round(discountMinor),
    netBeforeTaxMinor,
    taxEnabled: Boolean(taxEnabled && effectiveTaxRate > 0),
    taxRatePercent: effectiveTaxRate,
    taxAmountMinor,
    grandTotalMinor,
    estimatedPartsCostMinor,
    directLabourCostMinor,
    estimatedGrossProfitMinor,
  };
}

export function getApprovedEstimateRevision(estimate) {
  if (estimate?.status !== 'Approved') {
    throw new Error('An approved estimate is required before generating an invoice.');
  }

  const revision = estimate.revisions?.find(
    (item) => item.revisionNumber === estimate.currentRevision
  );
  if (!revision || revision.status !== 'Approved') {
    throw new Error('The current approved estimate revision could not be found.');
  }

  return revision;
}

export function mapEstimateRevisionToInvoiceLines(revision) {
  return {
    parts: (revision.parts || []).map((part) => ({
      part: part.part,
      sku: part.sku,
      name: part.name,
      quantity: part.quantity,
      isCustomerSupplied: part.isCustomerSupplied,
      unitPriceMinor: part.unitPriceMinor,
      unitCostMinor: part.unitCostMinor,
    })),
    labour: (revision.labour || []).map((labour) => ({
      description: labour.description,
      hours: labour.hours,
      rateMinor: labour.rateMinor,
      directLabourCostMinor: 0,
    })),
    discountMinor: Math.round(Number(revision.discountMinor || 0)),
    taxEnabled: Boolean(revision.taxEnabled),
    taxRatePercent: Number(revision.taxRatePercent || 0),
  };
}

/**
 * Derive invoice status and remaining balance from grandTotalMinor and active payments.
 */
export function deriveInvoiceBalanceAndStatus(grandTotalMinor, payments = [], isVoided = false) {
  if (isVoided) {
    return {
      paidMinor: 0,
      balanceDueMinor: 0,
      status: 'Voided',
    };
  }
  const activePayments = payments.filter((p) => !p.isReversed);
  const paidMinor = activePayments.reduce((sum, p) => sum + Math.round(Number(p.amountMinor || 0)), 0);
  const balanceDueMinor = Math.max(0, grandTotalMinor - paidMinor);

  let status = 'Unpaid';
  if (paidMinor >= grandTotalMinor && grandTotalMinor > 0) {
    status = 'Paid';
  } else if (paidMinor > 0 && paidMinor < grandTotalMinor) {
    status = 'Partially Paid';
  }

  return {
    paidMinor,
    balanceDueMinor,
    status,
  };
}

/**
 * Validate a payment against an invoice's current balance and idempotency registry.
 */
export function validatePaymentSubmission({
  invoice,
  existingPayments = [],
  amountMinor,
  idempotencyKey,
  method,
  allocateDepositMinor = 0,
}) {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 6) {
    throw new Error('A valid idempotencyKey is required to prevent duplicate payments');
  }
  const duplicate = existingPayments.find((p) => p.idempotencyKey === idempotencyKey.trim());
  if (duplicate) {
    return { duplicate: true, payment: duplicate };
  }
  if (invoice.isVoided) {
    throw new Error('Cannot record payment against a voided invoice');
  }
  const cleanAmount = Math.round(Number(amountMinor));
  const cleanDeposit = Math.round(Number(allocateDepositMinor || 0));
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }
  if (cleanDeposit < 0) {
    throw new Error('Deposit allocation cannot be negative');
  }
  if (!['Cash', 'Bank Transfer', 'Card', 'Deposit Allocation'].includes(method)) {
    throw new Error('Unsupported payment method');
  }

  const { balanceDueMinor } = deriveInvoiceBalanceAndStatus(
    invoice.grandTotalMinor,
    existingPayments,
    invoice.isVoided
  );

  if (cleanAmount > balanceDueMinor) {
    throw new Error(
      `Payment amount (${formatLkrFromMinor(cleanAmount)}) exceeds remaining invoice balance (${formatLkrFromMinor(balanceDueMinor)})`
    );
  }

  return {
    duplicate: false,
    amountMinor: cleanAmount,
    newBalanceDueMinor: balanceDueMinor - cleanAmount,
  };
}

/**
 * Validate job card status transition and cancellation reconciliation rules.
 */
export function validateJobStatusTransition({
  currentStatus,
  nextStatus,
  unreconciledPartsCount = 0,
  qualityCheckPassed = false,
  assignedMechanic = true,
}) {
  if (currentStatus === nextStatus) {
    return { valid: true };
  }
  const allowed = ALLOWED_JOB_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw new Error(`Invalid job status transition from "${currentStatus}" to "${nextStatus}"`);
  }
  if (!assignedMechanic && nextStatus !== 'Cancelled') {
    throw new Error('Assign an active mechanic before progressing this job card.');
  }
  if (nextStatus === 'Cancelled' && unreconciledPartsCount > 0) {
    throw new Error(
      `Cannot cancel job card while ${unreconciledPartsCount} issued workshop part(s) remain unreconciled. Return issued parts to stock first.`
    );
  }
  if (['Ready to Collect', 'Ready for Collection'].includes(nextStatus) && !qualityCheckPassed) {
    throw new Error('Final quality check must be completed before marking Ready to Collect');
  }
  return { valid: true };
}

export function assertJobReadyForInvoice(job) {
  if (
    !['Ready to Collect', 'Ready for Collection'].includes(job?.status) ||
    !job?.qualityCheckPassed ||
    !job?.assignedMechanic
  ) {
    const error = new Error(
      'The job card must be Ready to Collect after its final road-test and quality check before generating an invoice.'
    );
    error.statusCode = 409;
    throw error;
  }
}

/**
 * Role-based permission matrix for backend routes & Socket.IO room authorization.
 */
export const PERMISSIONS = Object.freeze({
  VIEW_DASHBOARD_FINANCIALS: [ROLES.ADMIN, ROLES.CASHIER, ROLES.RECEPTIONIST],
  MANAGE_CUSTOMERS_VEHICLES: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  VIEW_CUSTOMERS_VEHICLES: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.MECHANIC, ROLES.CASHIER],
  MANAGE_APPOINTMENTS: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  CREATE_JOB_CARD: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  UPDATE_JOB_WORK: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.MECHANIC],
  MANAGE_ESTIMATES: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  VIEW_PART_PURCHASE_COST: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  MANAGE_INVENTORY_STOCK: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  ISSUE_PART_TO_JOB: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.MECHANIC],
  MANAGE_INVOICES_PAYMENTS: [ROLES.ADMIN, ROLES.CASHIER, ROLES.RECEPTIONIST],
  VOID_INVOICE_OR_REVERSE_PAYMENT: [ROLES.ADMIN, ROLES.CASHIER],
  MANAGE_EXPENSES: [ROLES.ADMIN, ROLES.CASHIER],
  VIEW_FINANCIAL_REPORTS: [ROLES.ADMIN, ROLES.CASHIER],
  MANAGE_SETTINGS_AND_STAFF: [ROLES.ADMIN],
});

export function hasPermission(userRole, permissionKey) {
  const allowed = PERMISSIONS[permissionKey];
  if (!allowed) return false;
  return allowed.includes(userRole);
}

/**
 * Strip sensitive financial fields (e.g. purchaseCostMinor) from Part records when viewed by Mechanics.
 */
export function sanitizePartForRole(partObj, role) {
  const clone = { ...partObj };
  if (!hasPermission(role, 'VIEW_PART_PURCHASE_COST')) {
    delete clone.purchaseCostMinor;
  }
  return clone;
}
