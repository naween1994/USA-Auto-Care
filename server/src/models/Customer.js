import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    depositBalanceMinor: { type: Number, default: 0, min: 0 },
    isArchived: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, optimisticConcurrency: true }
);

customerSchema.index({ name: 'text', phone: 'text', email: 'text' });

export const Customer = mongoose.model('Customer', customerSchema);
