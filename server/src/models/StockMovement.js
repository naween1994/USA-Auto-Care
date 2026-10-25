import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    part: { type: mongoose.Schema.Types.ObjectId, ref: 'Part', required: true, index: true },
    movementType: {
      type: String,
      enum: ['RECEIPT', 'JOB_ISSUE', 'JOB_RETURN', 'ADJUSTMENT'],
      required: true,
      index: true,
    },
    quantityDelta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    unitCostMinor: { type: Number, default: 0, min: 0 },
    unitPriceMinor: { type: Number, default: 0, min: 0 },
    jobCard: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', default: null, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    reason: { type: String, required: true, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
