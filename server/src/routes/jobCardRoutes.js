import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { JobCard } from '../models/JobCard.js';
import { Appointment } from '../models/Appointment.js';
import { Vehicle } from '../models/Vehicle.js';
import { Part } from '../models/Part.js';
import { StockMovement } from '../models/StockMovement.js';
import { Reminder } from '../models/Reminder.js';
import { AuditLog } from '../models/AuditLog.js';
import { Counter } from '../models/Counter.js';
import {
  createJobCardSchema,
  updateJobCardSchema,
  jobStatusTransitionSchema,
  issueJobPartSchema,
  returnJobPartSchema,
} from '../validators/schemas.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { withTransaction, assertVersionMatch } from '../utils/dbTransaction.js';
import {
  toMinorUnits,
  validateJobStatusTransition,
  hasPermission,
  ROLES,
} from '../utils/domainLogic.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

const DEFAULT_INSPECTION_ITEMS = [
  { key: 'oil', label: 'Engine Oil Level & Condition', status: 'Good', notes: '' },
  { key: 'coolant', label: 'Coolant & Radiator System', status: 'Good', notes: '' },
  { key: 'brakes', label: 'Brake Pads, Discs & Fluid', status: 'Good', notes: '' },
  { key: 'tyres', label: 'Tyre Tread Depth & Pressure', status: 'Good', notes: '' },
  { key: 'battery', label: '12V / Hybrid Battery Health', status: 'Good', notes: '' },
  { key: 'lights', label: 'Headlights, Signals & Brake Lights', status: 'Good', notes: '' },
  { key: 'belts', label: 'Drive Belts & Hoses', status: 'Good', notes: '' },
  { key: 'leaks', label: 'Underbody & Visible Fluid Leaks', status: 'Good', notes: '' },
];

// Configure persistent Multer storage with strict MIME type and size validation
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `job-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 5) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WebP vehicle photos are permitted'));
    }
    return cb(null, true);
  },
});

function sanitizeJobCardForRole(job, role) {
  if (!job) return job;
  const clone = JSON.parse(JSON.stringify(job));
  if (!hasPermission(role, 'VIEW_PART_PURCHASE_COST')) {
    clone.issuedParts = (clone.issuedParts || []).map((ip) => {
      const { unitCostMinor, ...rest } = ip;
      return rest;
    });
    clone.labourCharges = (clone.labourCharges || []).map((lc) => {
      const { directLabourCostMinor, ...rest } = lc;
      return rest;
    });
  }
  return clone;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status;
    const assignedMechanic = req.query.assignedMechanic;
    const search = (req.query.search || '').trim();

    const query = {};
    if (status) query.status = status;
    if (assignedMechanic) query.assignedMechanic = assignedMechanic;
    if (req.user.role === ROLES.MECHANIC && req.query.onlyMine === 'true') {
      query.assignedMechanic = req.user._id;
    }
    if (search) {
      query.$or = [
        { jobNumber: { $regex: search, $options: 'i' } },
        { customerComplaints: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, items] = await Promise.all([
      JobCard.countDocuments(query),
      JobCard.find(query)
        .populate('customer', 'name phone email')
        .populate('vehicle', 'registrationNumber make model year fuelType mileageKm')
        .populate('assignedMechanic', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      data: items.map((j) => sanitizeJobCardForRole(j, req.user.role)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const job = await JobCard.findById(req.params.id)
      .populate('customer', 'name phone email address depositBalanceMinor')
      .populate('vehicle', 'registrationNumber make model year fuelType transmission mileageKm vin engineNumber')
      .populate('assignedMechanic', 'name email phone')
      .lean();
    if (!job) return res.status(404).json({ message: 'Job card not found' });
    return res.json({ data: sanitizeJobCardForRole(job, req.user.role) });
  } catch (err) {
    return next(err);
  }
});

// Create job card (directly or converted from an Arrived appointment)
router.post(
  '/',
  requireAuth,
  verifyCsrf,
  requirePermission('CREATE_JOB_CARD'),
  async (req, res, next) => {
    try {
      const parsed = createJobCardSchema.parse(req.body);

      const createdJob = await withTransaction(async (session) => {
        const jobNumber = await Counter.nextSequence('JOB_CARD', 'JOB', 5, session);

        const [job] = await JobCard.create(
          [
            {
              jobNumber,
              appointment: parsed.appointmentId || null,
              customer: parsed.customer,
              vehicle: parsed.vehicle,
              mileageInKm: parsed.mileageInKm,
              fuelLevel: parsed.fuelLevel,
              customerComplaints: parsed.customerComplaints,
              existingDamageNotes: parsed.existingDamageNotes || '',
              accessoriesNotes: parsed.accessoriesNotes || '',
              inspectionChecklist: DEFAULT_INSPECTION_ITEMS,
              assignedMechanic: parsed.assignedMechanic || null,
              estimatedCompletionAt: parsed.estimatedCompletionAt
                ? new Date(parsed.estimatedCompletionAt)
                : null,
              status: 'Checked In',
              statusHistory: [
                {
                  fromStatus: null,
                  toStatus: 'Checked In',
                  changedBy: req.user._id,
                  changedByName: req.user.name,
                  note: parsed.appointmentId
                    ? 'Checked in from appointment'
                    : 'Direct workshop check-in',
                },
              ],
            },
          ],
          { session }
        );

        // Update vehicle current mileage if higher
        await Vehicle.findOneAndUpdate(
          { _id: parsed.vehicle, mileageKm: { $lt: parsed.mileageInKm } },
          { $set: { mileageKm: parsed.mileageInKm } },
          { session }
        );

        if (parsed.appointmentId) {
          await Appointment.findByIdAndUpdate(
            parsed.appointmentId,
            { $set: { status: 'Arrived', convertedJobCard: job._id } },
            { session }
          );
        }

        await AuditLog.create(
          [
            {
              action: 'JOB_CARD_CREATED',
              entityType: 'JobCard',
              entityId: String(job._id),
              summary: `Opened Job Card ${jobNumber}`,
              metadata: { jobNumber, appointmentId: parsed.appointmentId || null },
              performedBy: req.user._id,
              performedByName: req.user.name,
              performedByRole: req.user.role,
            },
          ],
          { session }
        );

        return job;
      });

      emitDomainEvent('jobCards', 'created', { id: createdJob._id, jobNumber: createdJob.jobNumber });
      emitDomainEvent('appointments', 'updated', {});
      emitDomainEvent('dashboard', 'refresh', {});

      return res.status(201).json({ data: sanitizeJobCardForRole(createdJob, req.user.role) });
    } catch (err) {
      return next(err);
    }
  }
);

// Update job inspection, diagnosis, mechanic notes, work tasks, labour, quality check
router.put(
  '/:id',
  requireAuth,
  verifyCsrf,
  requirePermission('UPDATE_JOB_WORK'),
  async (req, res, next) => {
    try {
      const parsed = updateJobCardSchema.parse(req.body);
      const job = await JobCard.findById(req.params.id);
      if (!job) return res.status(404).json({ message: 'Job card not found' });

      assertVersionMatch(job, parsed.__v);

      if (parsed.mileageInKm !== undefined) job.mileageInKm = parsed.mileageInKm;
      if (parsed.fuelLevel !== undefined) job.fuelLevel = parsed.fuelLevel;
      if (parsed.customerComplaints !== undefined) job.customerComplaints = parsed.customerComplaints;
      if (parsed.existingDamageNotes !== undefined) job.existingDamageNotes = parsed.existingDamageNotes;
      if (parsed.accessoriesNotes !== undefined) job.accessoriesNotes = parsed.accessoriesNotes;
      if (parsed.diagnosisNotes !== undefined) job.diagnosisNotes = parsed.diagnosisNotes;
      if (parsed.mechanicNotes !== undefined) job.mechanicNotes = parsed.mechanicNotes;
      if (parsed.assignedMechanic !== undefined) job.assignedMechanic = parsed.assignedMechanic || null;
      if (parsed.estimatedCompletionAt !== undefined) {
        job.estimatedCompletionAt = parsed.estimatedCompletionAt
          ? new Date(parsed.estimatedCompletionAt)
          : null;
      }
      if (parsed.inspectionChecklist) {
        job.inspectionChecklist = parsed.inspectionChecklist;
      }
      if (parsed.workTasks) {
        job.workTasks = parsed.workTasks.map((t) => ({
          ...t,
          completedAt: t.completed ? new Date() : null,
          completedBy: t.completed ? req.user._id : null,
        }));
      }
      if (parsed.labourCharges) {
        job.labourCharges = parsed.labourCharges.map((lc) => {
          const rateMinor = toMinorUnits(lc.rateLkr);
          const directLabourCostMinor = toMinorUnits(lc.directLabourCostLkr || 0);
          return {
            description: lc.description,
            hours: lc.hours,
            rateMinor,
            directLabourCostMinor,
            lineTotalMinor: Math.round(lc.hours * rateMinor),
          };
        });
      }
      if (parsed.qualityCheckPassed !== undefined) {
        job.qualityCheckPassed = parsed.qualityCheckPassed;
        job.qualityCheckedBy = parsed.qualityCheckPassed ? req.user._id : null;
        job.qualityCheckedAt = parsed.qualityCheckPassed ? new Date() : null;
      }
      if (parsed.qualityCheckNotes !== undefined) {
        job.qualityCheckNotes = parsed.qualityCheckNotes;
      }
      if (parsed.nextServiceDate !== undefined) {
        job.nextServiceDate = parsed.nextServiceDate ? new Date(parsed.nextServiceDate) : null;
      }
      if (parsed.nextServiceMileageKm !== undefined) {
        job.nextServiceMileageKm = parsed.nextServiceMileageKm;
      }

      await job.save();

      // If next service reminder fields are provided, sync with Vehicle and Reminder
      if (job.nextServiceDate || job.nextServiceMileageKm) {
        await Vehicle.findByIdAndUpdate(job.vehicle, {
          $set: {
            nextServiceDate: job.nextServiceDate,
            nextServiceMileageKm: job.nextServiceMileageKm,
          },
        });
        if (job.nextServiceDate) {
          await Reminder.findOneAndUpdate(
            { jobCard: job._id },
            {
              $set: {
                customer: job.customer,
                vehicle: job.vehicle,
                dueDate: job.nextServiceDate,
                dueMileageKm: job.nextServiceMileageKm,
              },
            },
            { upsert: true, new: true }
          );
        }
      }

      emitDomainEvent('jobCards', 'updated', { id: job._id, jobNumber: job.jobNumber });
      emitDomainEvent('dashboard', 'refresh', {});
      return res.json({ data: sanitizeJobCardForRole(job, req.user.role) });
    } catch (err) {
      return next(err);
    }
  }
);

// Validated status transition with audit trail and cancellation part-reconciliation check
router.patch(
  '/:id/status',
  requireAuth,
  verifyCsrf,
  requirePermission('UPDATE_JOB_WORK'),
  async (req, res, next) => {
    try {
      const parsed = jobStatusTransitionSchema.parse(req.body);
      const job = await JobCard.findById(req.params.id);
      if (!job) return res.status(404).json({ message: 'Job card not found' });

      assertVersionMatch(job, parsed.__v);

      const unreconciledPartsCount = (job.issuedParts || []).filter(
        (ip) => !ip.isCustomerSupplied && ip.quantity - (ip.returnedQuantity || 0) > 0
      ).length;

      validateJobStatusTransition({
        currentStatus: job.status,
        nextStatus: parsed.status,
        unreconciledPartsCount,
        qualityCheckPassed: job.qualityCheckPassed,
      });

      const previousStatus = job.status;
      job.status = parsed.status;
      if (parsed.status === 'Delivered') {
        job.deliveredAt = new Date();
      }
      job.statusHistory.push({
        fromStatus: previousStatus,
        toStatus: parsed.status,
        changedBy: req.user._id,
        changedByName: req.user.name,
        note: parsed.note || '',
        changedAt: new Date(),
      });

      await job.save();

      await AuditLog.create({
        action: 'JOB_STATUS_CHANGED',
        entityType: 'JobCard',
        entityId: String(job._id),
        summary: `Job ${job.jobNumber} status changed: ${previousStatus} -> ${parsed.status}`,
        metadata: { jobNumber: job.jobNumber, from: previousStatus, to: parsed.status, note: parsed.note },
        performedBy: req.user._id,
        performedByName: req.user.name,
        performedByRole: req.user.role,
      });

      emitDomainEvent('jobCards', 'statusChanged', {
        id: job._id,
        jobNumber: job.jobNumber,
        status: job.status,
      });
      emitDomainEvent('dashboard', 'refresh', {});

      return res.json({ data: sanitizeJobCardForRole(job, req.user.role) });
    } catch (err) {
      return next(err);
    }
  }
);

// Issue part to a job card (atomic stock deduction for workshop parts, or zero-deduction for customer-supplied parts)
router.post(
  '/:id/parts/issue',
  requireAuth,
  verifyCsrf,
  requirePermission('ISSUE_PART_TO_JOB'),
  async (req, res, next) => {
    try {
      const parsed = issueJobPartSchema.parse(req.body);

      const updatedJob = await withTransaction(async (session) => {
        const job = await JobCard.findById(req.params.id).session(session);
        if (!job) {
          const err = new Error('Job card not found');
          err.statusCode = 404;
          throw err;
        }
        if (['Delivered', 'Cancelled'].includes(job.status)) {
          throw new Error(`Cannot issue parts to a ${job.status} job card`);
        }

        if (parsed.isCustomerSupplied) {
          job.issuedParts.push({
            part: null,
            sku: parsed.sku || 'CUST-SUPPLIED',
            name: parsed.name || 'Customer-Supplied Part',
            quantity: parsed.quantity,
            returnedQuantity: 0,
            isCustomerSupplied: true,
            unitCostMinor: 0,
            unitPriceMinor: 0,
            issuedBy: req.user._id,
          });
          await job.save({ session });
          return job;
        }

        if (!parsed.partId) {
          throw new Error('Part ID is required when issuing workshop inventory');
        }

        // Atomic conditional stock decrement prevents negative inventory under concurrent requests
        const part = await Part.findOneAndUpdate(
          {
            _id: parsed.partId,
            isActive: true,
            quantityOnHand: { $gte: parsed.quantity },
          },
          { $inc: { quantityOnHand: -parsed.quantity } },
          { new: true, session }
        );

        if (!part) {
          const existingPart = await Part.findById(parsed.partId).session(session);
          if (!existingPart) {
            throw new Error('Selected inventory part does not exist');
          }
          throw new Error(
            `Insufficient stock for ${existingPart.name} (${existingPart.sku}). Available: ${existingPart.quantityOnHand}, requested: ${parsed.quantity}`
          );
        }

        const unitPriceMinor =
          parsed.unitPriceLkr !== undefined ? toMinorUnits(parsed.unitPriceLkr) : part.sellingPriceMinor;

        job.issuedParts.push({
          part: part._id,
          sku: part.sku,
          name: part.name,
          quantity: parsed.quantity,
          returnedQuantity: 0,
          isCustomerSupplied: false,
          unitCostMinor: part.purchaseCostMinor,
          unitPriceMinor,
          issuedBy: req.user._id,
        });

        await job.save({ session });

        await StockMovement.create(
          [
            {
              part: part._id,
              movementType: 'JOB_ISSUE',
              quantityDelta: -parsed.quantity,
              balanceAfter: part.quantityOnHand,
              unitCostMinor: part.purchaseCostMinor,
              unitPriceMinor,
              jobCard: job._id,
              reason: `Issued to Job Card ${job.jobNumber}`,
              performedBy: req.user._id,
            },
          ],
          { session }
        );

        return job;
      });

      emitDomainEvent('jobCards', 'partIssued', { id: updatedJob._id });
      emitDomainEvent('inventory', 'updated', {});
      emitDomainEvent('dashboard', 'refresh', {});

      return res.status(201).json({ data: sanitizeJobCardForRole(updatedJob, req.user.role) });
    } catch (err) {
      return next(err);
    }
  }
);

// Return issued part back to stock (creates a reversing StockMovement entry)
router.post(
  '/:id/parts/return',
  requireAuth,
  verifyCsrf,
  requirePermission('ISSUE_PART_TO_JOB'),
  async (req, res, next) => {
    try {
      const parsed = returnJobPartSchema.parse(req.body);

      const updatedJob = await withTransaction(async (session) => {
        const job = await JobCard.findById(req.params.id).session(session);
        if (!job) throw new Error('Job card not found');

        const issuedLine = job.issuedParts.id(parsed.issuedPartId);
        if (!issuedLine) throw new Error('Issued part line not found on this job card');

        const maxReturnable = issuedLine.quantity - (issuedLine.returnedQuantity || 0);
        if (parsed.returnQuantity > maxReturnable) {
          throw new Error(`Cannot return ${parsed.returnQuantity}; only ${maxReturnable} remaining on job`);
        }

        issuedLine.returnedQuantity = (issuedLine.returnedQuantity || 0) + parsed.returnQuantity;
        await job.save({ session });

        if (!issuedLine.isCustomerSupplied && issuedLine.part) {
          const part = await Part.findByIdAndUpdate(
            issuedLine.part,
            { $inc: { quantityOnHand: parsed.returnQuantity } },
            { new: true, session }
          );

          await StockMovement.create(
            [
              {
                part: part._id,
                movementType: 'JOB_RETURN',
                quantityDelta: parsed.returnQuantity,
                balanceAfter: part.quantityOnHand,
                unitCostMinor: issuedLine.unitCostMinor,
                unitPriceMinor: issuedLine.unitPriceMinor,
                jobCard: job._id,
                reason: `Returned from Job ${job.jobNumber}: ${parsed.reason}`,
                performedBy: req.user._id,
              },
            ],
            { session }
          );
        }

        return job;
      });

      emitDomainEvent('jobCards', 'partReturned', { id: updatedJob._id });
      emitDomainEvent('inventory', 'updated', {});
      emitDomainEvent('dashboard', 'refresh', {});

      return res.json({ data: sanitizeJobCardForRole(updatedJob, req.user.role) });
    } catch (err) {
      return next(err);
    }
  }
);

// Upload inspection / damage photos to Job Card
router.post(
  '/:id/photos',
  requireAuth,
  verifyCsrf,
  requirePermission('UPDATE_JOB_WORK'),
  upload.single('photo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Please attach a valid JPEG, PNG, or WebP photo' });
      }
      const job = await JobCard.findById(req.params.id);
      if (!job) return res.status(404).json({ message: 'Job card not found' });

      const photoEntry = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        url: `/uploads/${req.file.filename}`,
        caption: req.body.caption || '',
        uploadedBy: req.user._id,
        uploadedAt: new Date(),
      };

      job.photos.push(photoEntry);
      await job.save();

      emitDomainEvent('jobCards', 'photoUploaded', { id: job._id });
      return res.status(201).json({ data: sanitizeJobCardForRole(job, req.user.role) });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
