import mongoose from 'mongoose';
import { ROLES } from '../utils/domainLogic.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      index: true,
    },
    phone: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const User = mongoose.model('User', userSchema);
