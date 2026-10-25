#!/usr/bin/env node
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User.js';
import { Customer } from '../src/models/Customer.js';
import { Vehicle } from '../src/models/Vehicle.js';
import { Supplier } from '../src/models/Supplier.js';
import { Part } from '../src/models/Part.js';
import { Appointment } from '../src/models/Appointment.js';
import { BusinessSettings } from '../src/models/BusinessSettings.js';
import { ROLES, toMinorUnits } from '../src/utils/domainLogic.js';

/**
 * OPTIONAL Development Seed Script (Strictly blocked in NODE_ENV=production).
 */
async function seedDevelopmentData() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ABORTED: Development seed script must never run in production.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is required in server/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to development database. Seeding sample workshop records...');

  await BusinessSettings.findOneAndUpdate(
    { singletonKey: 'DEFAULT' },
    {
      $setOnInsert: {
        businessName: 'USA Auto Care',
        location: 'Alawwa, Sri Lanka',
        currency: 'LKR',
        timezone: 'Asia/Colombo',
        taxEnabled: false,
        taxRatePercent: 0,
        defaultLabourRateMinor: toMinorUnits(3500),
      },
    },
    { upsert: true }
  );

  const devPassHash = await bcrypt.hash(process.env.DEV_SEED_PASSWORD || 'DevWorkshop#2026', 10);

  const staffDocs = [
    { name: 'Nuwan Perera (Admin)', email: 'admin.dev@usaautocare.local', role: ROLES.ADMIN },
    { name: 'Dilani Jayasinghe (Reception)', email: 'reception.dev@usaautocare.local', role: ROLES.RECEPTIONIST },
    { name: 'Kasun Bandara (Senior Mechanic)', email: 'mechanic.dev@usaautocare.local', role: ROLES.MECHANIC },
    { name: 'Roshan Silva (Cashier)', email: 'cashier.dev@usaautocare.local', role: ROLES.CASHIER },
  ];

  for (const s of staffDocs) {
    await User.findOneAndUpdate(
      { email: s.email },
      { $setOnInsert: { ...s, passwordHash: devPassHash, isActive: true } },
      { upsert: true }
    );
  }

  const supplier = await Supplier.findOneAndUpdate(
    { name: 'Lanka Auto Parts Distributors (Kurunegala)' },
    {
      $setOnInsert: {
        contactPerson: 'Chaminda Rathnayake',
        phone: '037-2220000',
        address: 'Colombo Road, Kurunegala',
      },
    },
    { upsert: true, new: true }
  );

  const sampleParts = [
    {
      sku: 'OIL-0W20-4L',
      name: 'Toyota Genuine 0W-20 Synthetic Motor Oil (4L)',
      category: 'Lubricants & Fluids',
      compatibilityNotes: 'Toyota Aqua, Prius, Axio, Premio, Honda Fit GP5',
      unit: 'can',
      purchaseCostMinor: toMinorUnits(11800),
      sellingPriceMinor: toMinorUnits(14500),
      quantityOnHand: 18,
      reorderThreshold: 5,
      supplier: supplier._id,
      storageLocation: 'Rack A-01',
    },
    {
      sku: 'FLT-OIL-90915',
      name: 'OEM Spin-On Oil Filter 90915-YZZF2',
      category: 'Filters',
      compatibilityNotes: 'Toyota NZ / ZR Series Engines',
      unit: 'pcs',
      purchaseCostMinor: toMinorUnits(1950),
      sellingPriceMinor: toMinorUnits(2800),
      quantityOnHand: 24,
      reorderThreshold: 8,
      supplier: supplier._id,
      storageLocation: 'Rack B-04',
    },
    {
      sku: 'BRK-PAD-FR-AQUA',
      name: 'Ceramic Front Brake Pad Set (NHP10 / GP5)',
      category: 'Brakes',
      compatibilityNotes: 'Toyota Aqua NHP10, Yaris, Vitz',
      unit: 'set',
      purchaseCostMinor: toMinorUnits(7200),
      sellingPriceMinor: toMinorUnits(9800),
      quantityOnHand: 4, // Low stock trigger
      reorderThreshold: 5,
      supplier: supplier._id,
      storageLocation: 'Rack C-02',
    },
    {
      sku: 'COOL-LLC-2L',
      name: 'Super Long Life Pink Coolant Pre-mixed (2L)',
      category: 'Lubricants & Fluids',
      compatibilityNotes: 'Japanese Hybrid & Petrol Cooling Systems',
      unit: 'bottle',
      purchaseCostMinor: toMinorUnits(4100),
      sellingPriceMinor: toMinorUnits(5500),
      quantityOnHand: 3, // Low stock trigger
      reorderThreshold: 6,
      supplier: supplier._id,
      storageLocation: 'Rack A-03',
    },
  ];

  for (const p of sampleParts) {
    await Part.findOneAndUpdate({ sku: p.sku }, { $setOnInsert: p }, { upsert: true });
  }

  const cust = await Customer.findOneAndUpdate(
    { phone: '077-4128900' },
    {
      $setOnInsert: {
        name: 'Sampath Ekanayake',
        phone: '077-4128900',
        email: 'sampath.e@example.lk',
        address: 'Giriulla Road, Alawwa',
        notes: 'Prefers synthetic oil and afternoon collection',
      },
    },
    { upsert: true, new: true }
  );

  const veh = await Vehicle.findOneAndUpdate(
    { normalizedRegistration: 'NW-CAA-4512' },
    {
      $setOnInsert: {
        customer: cust._id,
        registrationNumber: 'NW-CAA-4512',
        normalizedRegistration: 'NW-CAA-4512',
        make: 'Toyota',
        model: 'Axio Hybrid WxB',
        year: 2017,
        fuelType: 'Hybrid',
        transmission: 'CVT',
        mileageKm: 84250,
        vin: 'NKE165-7098123',
        engineNumber: '1NZ-8821041',
      },
    },
    { upsert: true, new: true }
  );

  const existingAppt = await Appointment.findOne({ vehicle: veh._id });
  if (!existingAppt) {
    await Appointment.create({
      customer: cust._id,
      vehicle: veh._id,
      isWalkIn: false,
      requestedService: '85,000 km Full Hybrid Periodic Service & Brake Inspection',
      scheduledAt: new Date(),
      status: 'Arrived',
      notes: 'Customer reported slight front brake squeal on cold mornings',
    });
  }

  console.log('Development seed complete.');
  await mongoose.disconnect();
}

seedDevelopmentData().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
