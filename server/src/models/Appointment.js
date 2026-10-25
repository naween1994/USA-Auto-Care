import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    isWalkIn: { type: Boolean, default: false },
    requestedService: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, required: true, index: true },
    notes: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['Scheduled', 'Confirmed', 'Arrived', 'Cancelled', 'No-show'],
      default: 'Scheduled',
      index: true,
    },
    convertedJobCard: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Appointment = mongoose.model('Appointment', appointmentSchema);
