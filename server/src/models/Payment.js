import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    paymentType: {
      type: String,
      enum: ['INVOICE_PAYMENT', 'CUSTOMER_DEPOSIT', 'DEPOSIT_ALLOCATION'],
      default: 'INVOICE_PAYMENT',
    },
    method: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Card', 'Deposit Allocation'],
      required: true,
    },
    amountMinor: { type: Number, required: true, min: 1 },
    referenceNumber: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    isReversed: { type: Boolean, default: false, index: true },
    reversalReason: { type: String, default: '' },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paidAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
