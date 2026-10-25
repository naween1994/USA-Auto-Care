import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    contactPerson: { type: String, trim: true, default: '' },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Supplier = mongoose.model('Supplier', supplierSchema);
