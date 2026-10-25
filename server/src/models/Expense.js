import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['Utilities', 'Workshop Consumables', 'Tools & Equipment', 'Rent', 'Staff Welfare', 'Transport', 'Other'],
      required: true,
      index: true,
    },
    amountMinor: { type: Number, required: true, min: 1 },
    incurredOn: { type: Date, required: true, index: true },
    vendorName: { type: String, trim: true, default: '' },
    notes: { type: String, required: true, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Expense = mongoose.model('Expense', expenseSchema);
