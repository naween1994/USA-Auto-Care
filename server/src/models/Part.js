import mongoose from 'mongoose';

const partSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    compatibilityNotes: { type: String, trim: true, default: '' },
    unit: { type: String, required: true, default: 'pcs' },
    purchaseCostMinor: { type: Number, required: true, min: 0 },
    sellingPriceMinor: { type: Number, required: true, min: 0 },
    quantityOnHand: { type: Number, required: true, default: 0, min: 0 },
    reorderThreshold: { type: Number, required: true, default: 5, min: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    storageLocation: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Part = mongoose.model('Part', partSchema);
