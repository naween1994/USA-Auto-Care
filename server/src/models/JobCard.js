import mongoose from 'mongoose';
import { JOB_STATUSES } from '../utils/domainLogic.js';

const inspectionItemSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ['oil', 'coolant', 'brakes', 'tyres', 'battery', 'lights', 'belts', 'leaks'],
      required: true,
    },
    label: { type: String, required: true },
    status: {
      type: String,
      enum: ['Good', 'Attention Needed', 'Urgent'],
      default: 'Good',
    },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const workTaskSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true }
);

const issuedPartSchema = new mongoose.Schema(
  {
    part: { type: mongoose.Schema.Types.ObjectId, ref: 'Part', default: null },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    isCustomerSupplied: { type: Boolean, default: false },
    unitCostMinor: { type: Number, required: true, min: 0 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const labourChargeSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    hours: { type: Number, required: true, min: 0.1, default: 1 },
    rateMinor: { type: Number, required: true, min: 0 },
    directLabourCostMinor: { type: Number, default: 0, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const photoMetadataSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    url: { type: String, required: true },
    caption: { type: String, trim: true, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedByName: { type: String, required: true },
    note: { type: String, trim: true, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const jobCardSchema = new mongoose.Schema(
  {
    jobNumber: { type: String, required: true, unique: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    checkInAt: { type: Date, default: Date.now, index: true },
    mileageInKm: { type: Number, required: true, min: 0 },
    fuelLevel: {
      type: String,
      enum: ['Empty', '1/4', '1/2', '3/4', 'Full'],
      required: true,
    },
    customerComplaints: { type: String, required: true, trim: true },
    existingDamageNotes: { type: String, trim: true, default: '' },
    accessoriesNotes: { type: String, trim: true, default: '' },
    inspectionChecklist: { type: [inspectionItemSchema], default: [] },
    diagnosisNotes: { type: String, trim: true, default: '' },
    mechanicNotes: { type: String, trim: true, default: '' },
    assignedMechanic: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    estimatedCompletionAt: { type: Date, default: null },
    workTasks: { type: [workTaskSchema], default: [] },
    issuedParts: { type: [issuedPartSchema], default: [] },
    labourCharges: { type: [labourChargeSchema], default: [] },
    photos: { type: [photoMetadataSchema], default: [] },
    qualityCheckPassed: { type: Boolean, default: false },
    qualityCheckNotes: { type: String, trim: true, default: '' },
    qualityCheckedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    qualityCheckedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'Checked In',
      index: true,
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    nextServiceDate: { type: Date, default: null },
    nextServiceMileageKm: { type: Number, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const JobCard = mongoose.model('JobCard', jobCardSchema);
