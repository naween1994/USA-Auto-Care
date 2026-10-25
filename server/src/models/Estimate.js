import mongoose from 'mongoose';

const estimatePartItemSchema = new mongoose.Schema(
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

const estimateLabourItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    hours: { type: Number, required: true, min: 0.1 },
    rateMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const estimateRevisionSchema = new mongoose.Schema(
  {
    revisionNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Approved', 'Rejected'],
      required: true,
    },
    parts: { type: [estimatePartItemSchema], default: [] },
    labour: { type: [estimateLabourItemSchema], default: [] },
    partsSubtotalMinor: { type: Number, required: true },
    labourSubtotalMinor: { type: Number, required: true },
    discountMinor: { type: Number, default: 0 },
    taxEnabled: { type: Boolean, default: false },
    taxRatePercent: { type: Number, default: 0 },
    taxAmountMinor: { type: Number, default: 0 },
    grandTotalMinor: { type: Number, required: true },
    approvalDetails: {
      method: { type: String, enum: ['In-Person', 'Phone', null], default: null },
      approvingCustomerName: { type: String, default: '' },
      approvedAt: { type: Date, default: null },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      recordedByName: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const estimateSchema = new mongoose.Schema(
  {
    estimateNumber: { type: String, required: true, unique: true, index: true },
    jobCard: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    currentRevision: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Approved', 'Rejected'],
      default: 'Draft',
      index: true,
    },
    parts: { type: [estimatePartItemSchema], default: [] },
    labour: { type: [estimateLabourItemSchema], default: [] },
    partsSubtotalMinor: { type: Number, default: 0 },
    labourSubtotalMinor: { type: Number, default: 0 },
    discountMinor: { type: Number, default: 0 },
    taxEnabled: { type: Boolean, default: false },
    taxRatePercent: { type: Number, default: 0 },
    taxAmountMinor: { type: Number, default: 0 },
    grandTotalMinor: { type: Number, default: 0 },
    approvalDetails: {
      method: { type: String, enum: ['In-Person', 'Phone', null], default: null },
      approvingCustomerName: { type: String, default: '' },
      approvedAt: { type: Date, default: null },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      recordedByName: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    revisions: { type: [estimateRevisionSchema], default: [] },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Estimate = mongoose.model('Estimate', estimateSchema);
