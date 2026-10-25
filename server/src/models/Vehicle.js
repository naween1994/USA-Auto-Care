import mongoose from 'mongoose';
import { normalizeRegistrationNumber } from '../utils/domainLogic.js';

const vehicleSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    registrationNumber: { type: String, required: true, trim: true },
    normalizedRegistration: { type: String, required: true, unique: true, index: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1950, max: 2100 },
    fuelType: {
      type: String,
      enum: ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Other'],
      required: true,
    },
    transmission: {
      type: String,
      enum: ['Automatic', 'Manual', 'CVT', 'DCT', 'Other'],
      required: true,
    },
    mileageKm: { type: Number, required: true, min: 0 },
    vin: { type: String, trim: true, default: '' },
    engineNumber: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    nextServiceDate: { type: Date, default: null },
    nextServiceMileageKm: { type: Number, default: null },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

vehicleSchema.pre('validate', function (next) {
  if (this.registrationNumber) {
    this.normalizedRegistration = normalizeRegistrationNumber(this.registrationNumber);
    this.registrationNumber = this.normalizedRegistration;
  }
  next();
});

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
