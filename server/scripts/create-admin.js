#!/usr/bin/env node
import 'dotenv/config';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User.js';
import { BusinessSettings } from '../src/models/BusinessSettings.js';
import { ROLES } from '../src/utils/domainLogic.js';

/**
 * Secure CLI utility to bootstrap the initial Owner/Admin account for USA Auto Care.
 * Does NOT hardcode production credentials or allow public admin registration.
 *
 * Usage:
 *   npm --prefix server run create-admin -- --name="Owner Name" --email="admin@example.com" --password="StrongPassword123!"
 *   or run interactively without flags.
 */
async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI must be configured in server/.env before running create-admin.');
    process.exit(1);
  }

  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [k, v] = arg.replace(/^--/, '').split('=');
      return [k, v];
    })
  );

  const rl = readline.createInterface({ input, output });
  try {
    const name = args.name || (await rl.question('Admin Full Name: ')).trim();
    const email = (args.email || (await rl.question('Admin Email: '))).trim().toLowerCase();
    const password = args.password || (await rl.question('Admin Password (min 8 chars): ')).trim();

    if (!name || !email || password.length < 8) {
      console.error('Validation failed: Name, valid email, and password (>= 8 chars) are required.');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await User.findOne({ email });
    const passwordHash = await bcrypt.hash(password, 12);

    if (existing) {
      existing.name = name;
      existing.passwordHash = passwordHash;
      existing.role = ROLES.ADMIN;
      existing.isActive = true;
      await existing.save();
      console.log(`Updated existing admin user: ${email}`);
    } else {
      await User.create({
        name,
        email,
        passwordHash,
        role: ROLES.ADMIN,
        isActive: true,
      });
      console.log(`Created initial Owner/Admin user: ${email}`);
    }

    // Ensure singleton BusinessSettings document exists with uninvented optional fields
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
        },
      },
      { upsert: true, new: true }
    );

    console.log('USA Auto Care admin initialization complete.');
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Admin creation failed:', err.message);
  process.exit(1);
});
