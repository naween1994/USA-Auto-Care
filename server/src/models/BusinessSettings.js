import mongoose from 'mongoose';

/**
 * Business Settings for USA Auto Care (Alawwa, Sri Lanka).
 * Intentionally does NOT invent a phone number, street address, tax registration number,
 * or establishment year — all are configurable by the Owner/Admin.
 */
const businessSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'DEFAULT', unique: true },
    businessName: { type: String, default: 'USA Auto Care' },
    location: { type: String, default: 'Alawwa, Sri Lanka' },
    currency: { type: String, default: 'LKR' },
    timezone: { type: String, default: 'Asia/Colombo' },
    phone: { type: String, default: '0773995399 / 0703995399' },
    email: { type: String, default: 'usaautocare66@gmail.com' },
    streetAddress: { type: String, default: '' },
    taxRegistrationNumber: { type: String, default: '' },
    establishedYear: { type: Number, default: null },
    logoUrl: { type: String, default: '/logo.jpeg' },
    invoiceFooter: {
      type: String,
      default: 'Thank you for choosing USA Auto Care, Alawwa. Hotlines: 0773995399 / 0703995399 • Email: usaautocare66@gmail.com',
    },
    taxEnabled: { type: Boolean, default: false },
    taxLabel: { type: String, default: 'VAT' },
    taxRatePercent: { type: Number, default: 0, min: 0, max: 100 },
    defaultLabourRateMinor: { type: Number, default: 350000, min: 0 }, // LKR 3,500.00/hr default
    serviceCategories: {
      type: [String],
      default: [
        'Full Periodic Service',
        'Engine Diagnostics & Tune-up',
        'Brake Overhaul & Pad Replacement',
        'Hybrid System Inspection',
        'Suspension & Steering Repair',
        'A/C Servicing & Regas',
        'Transmission Service',
        'Electrical & Battery Replacement',
      ],
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const BusinessSettings = mongoose.model('BusinessSettings', businessSettingsSchema);
