import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { initSocketServer } from './socket/socketManager.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import jobCardRoutes from './routes/jobCardRoutes.js';
import estimateRoutes from './routes/estimateRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import invoicePaymentRoutes from './routes/invoicePaymentRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import expenseReportRoutes from './routes/expenseReportRoutes.js';
import settingsAuditRoutes from './routes/settingsAuditRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Serve uploaded inspection & vehicle photos from configurable persistent directory
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    business: 'USA Auto Care',
    location: 'Alawwa, Sri Lanka',
    timezone: 'Asia/Colombo',
    currency: 'LKR',
    dbState: mongoose.connection.readyState,
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/job-cards', jobCardRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', invoicePaymentRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/finance', expenseReportRoutes);
app.use('/api/admin', settingsAuditRoutes);

// In production, serve the built React SPA from Express on the same origin
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

async function bootstrap() {
  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB database for USA Auto Care (Alawwa, Sri Lanka)');

  initSocketServer(httpServer, CLIENT_ORIGIN);

  httpServer.listen(PORT, () => {
    console.log(`USA Auto Care Server listening on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}
