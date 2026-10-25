import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

/**
 * Atomically increments and returns a formatted sequence number (safe under concurrent requests).
 */
counterSchema.statics.nextSequence = async function (key, prefix, padLength = 5, session = null) {
  const opts = { new: true, upsert: true };
  if (session) opts.session = session;
  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    opts
  );
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(doc.seq).padStart(padLength, '0')}`;
};

export const Counter = mongoose.model('Counter', counterSchema);
