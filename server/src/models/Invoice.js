import mongoose from 'mongoose';

const invoicePartLineSchema = new mongoose.Schema(
  {
    part: { type: mongoose.Schema.Types.ObjectId, ref: 'Part', default: null },
    sku: { type: String, default: '' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    isCustomerSupplied: { type: Boolean, default: false },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    unitCostMinor: { type: Number, default: 0, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceLabourLineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    hours: { type: Number, required: true, min: 0.1 },
    rateMinor: { type: Number, required: true, min: 0 },
    directLabourCostMinor: { type: Number, default: 0, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    jobCard: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', required: true },
    estimate: { type: mongoose.Schema.Types.ObjectId, ref: 'Estimate', default: null },
    estimateNumber: { type: String, default: '' },
    estimateRevision: { type: Number, default: 0, min: 0 },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    businessSnapshot: {
      businessName: { type: String, required: true },
      location: { type: String, required: true },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
      taxRegistrationNumber: { type: String, default: '' },
      invoiceFooter: { type: String, default: '' },
    },
    parts: { type: [invoicePartLineSchema], default: [] },
    labour: { type: [invoiceLabourLineSchema], default: [] },
    partsSubtotalMinor: { type: Number, required: true, min: 0 },
    labourSubtotalMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, default: 0, min: 0 },
    taxEnabled: { type: Boolean, default: false },
    taxRatePercent: { type: Number, default: 0 },
    taxAmountMinor: { type: Number, default: 0, min: 0 },
    grandTotalMinor: { type: Number, required: true, min: 0 },
    paidMinor: { type: Number, default: 0, min: 0 },
    balanceDueMinor: { type: Number, required: true, min: 0 },
    estimatedPartsCostMinor: { type: Number, default: 0, min: 0 },
    directLabourCostMinor: { type: Number, default: 0, min: 0 },
    estimatedGrossProfitMinor: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Unpaid', 'Partially Paid', 'Paid', 'Voided'],
      default: 'Unpaid',
      index: true,
    },
    paymentTerms: { type: String, default: 'Due on receipt' },
    notes: { type: String, default: '' },
    isVoided: { type: Boolean, default: false, index: true },
    voidReason: { type: String, default: '' },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

invoiceSchema.index(
  { jobCard: 1 },
  {
    unique: true,
    partialFilterExpression: { isVoided: false },
    name: 'active_invoice_per_job',
  }
);

export const Invoice = mongoose.model('Invoice', invoiceSchema);
