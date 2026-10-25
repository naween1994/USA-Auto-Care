import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    jobCard: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', default: null },
    dueDate: { type: Date, required: true, index: true },
    dueMileageKm: { type: Number, default: null },
    serviceType: { type: String, default: 'Periodic Maintenance Service' },
    status: {
      type: String,
      enum: ['Pending', 'Contacted', 'Booked', 'Dismissed'],
      default: 'Pending',
      index: true,
    },
    contactedAt: { type: Date, default: null },
    contactedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    contactMethod: { type: String, enum: ['Phone Call', 'In-Person', 'Manual SMS/WhatsApp', null], default: null },
    contactNotes: { type: String, trim: true, default: '' },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const Reminder = mongoose.model('Reminder', reminderSchema);
