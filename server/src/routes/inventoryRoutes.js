import express from 'express';
import { Part } from '../models/Part.js';
import { Supplier } from '../models/Supplier.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { partSchema, stockAdjustmentSchema } from '../validators/schemas.js';
import { requireAuth, requirePermission, verifyCsrf } from '../middleware/auth.js';
import { withTransaction, assertVersionMatch } from '../utils/dbTransaction.js';
import { toMinorUnits, sanitizePartForRole } from '../utils/domainLogic.js';
import { emitDomainEvent } from '../socket/socketManager.js';

const router = express.Router();

router.get('/parts', requireAuth, async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const category = req.query.category;
    const lowStockOnly = req.query.lowStock === 'true';

    const query = { isActive: true, isArchived: { $ne: true } };
    if (category) query.category = category;
    if (lowStockOnly) {
      query.$expr = { $lte: ['$quantityOnHand', '$reorderThreshold'] };
    }
    if (search) {
      query.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { compatibilityNotes: { $regex: search, $options: 'i' } },
      ];
    }

    const parts = await Part.find(query)
      .populate('supplier', 'name phone')
      .sort({ name: 1 })
      .lean();

    return res.json({
      data: parts.map((p) => sanitizePartForRole(p, req.user.role)),
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/parts',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_INVENTORY_STOCK'),
  async (req, res, next) => {
    try {
      const parsed = partSchema.parse(req.body);
      const purchaseCostMinor = toMinorUnits(parsed.purchaseCostLkr);
      const sellingPriceMinor = toMinorUnits(parsed.sellingPriceLkr);

      const createdPart = await withTransaction(async (session) => {
        const [part] = await Part.create(
          [
            {
              sku: parsed.sku.toUpperCase().trim(),
              name: parsed.name,
              category: parsed.category,
              compatibilityNotes: parsed.compatibilityNotes || '',
              unit: parsed.unit || 'pcs',
              purchaseCostMinor,
              sellingPriceMinor,
              quantityOnHand: parsed.quantityOnHand || 0,
              reorderThreshold: parsed.reorderThreshold ?? 5,
              supplier: parsed.supplier || null,
              storageLocation: parsed.storageLocation || '',
            },
          ],
          { session }
        );

        if (part.quantityOnHand > 0) {
          await StockMovement.create(
            [
              {
                part: part._id,
                movementType: 'RECEIPT',
                quantityDelta: part.quantityOnHand,
                balanceAfter: part.quantityOnHand,
                unitCostMinor: purchaseCostMinor,
                unitPriceMinor: sellingPriceMinor,
                supplier: part.supplier,
                reason: 'Initial opening stock balance',
                performedBy: req.user._id,
              },
            ],
            { session }
          );
        }
        return part;
      });

      emitDomainEvent('inventory', 'partCreated', { id: createdPart._id });
      emitDomainEvent('dashboard', 'refresh', {});
      return res.status(201).json({ data: createdPart });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/parts/:id',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_INVENTORY_STOCK'),
  async (req, res, next) => {
    try {
      const parsed = partSchema.parse(req.body);
      const part = await Part.findById(req.params.id);
      if (!part) return res.status(404).json({ message: 'Part not found' });

      assertVersionMatch(part, parsed.__v);

      part.sku = parsed.sku.toUpperCase().trim();
      part.name = parsed.name;
      part.category = parsed.category;
      part.compatibilityNotes = parsed.compatibilityNotes || '';
      part.unit = parsed.unit;
      part.purchaseCostMinor = toMinorUnits(parsed.purchaseCostLkr);
      part.sellingPriceMinor = toMinorUnits(parsed.sellingPriceLkr);
      part.reorderThreshold = parsed.reorderThreshold;
      part.supplier = parsed.supplier || null;
      part.storageLocation = parsed.storageLocation || '';

      await part.save();

      emitDomainEvent('inventory', 'partUpdated', { id: part._id });
      return res.json({ data: part });
    } catch (err) {
      return next(err);
    }
  }
);

// Atomic Stock Receipt or Stock Adjustment with StockMovement Ledger and AuditLog
router.post(
  '/parts/:id/movements',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_INVENTORY_STOCK'),
  async (req, res, next) => {
    try {
      const parsed = stockAdjustmentSchema.parse(req.body);

      const result = await withTransaction(async (session) => {
        const filter = { _id: req.params.id };
        if (parsed.quantityDelta < 0) {
          filter.quantityOnHand = { $gte: Math.abs(parsed.quantityDelta) };
        }

        const updateFields = { $inc: { quantityOnHand: parsed.quantityDelta } };
        if (parsed.unitCostLkr !== undefined) {
          updateFields.$set = { purchaseCostMinor: toMinorUnits(parsed.unitCostLkr) };
        }

        const part = await Part.findOneAndUpdate(filter, updateFields, {
          new: true,
          session,
        });

        if (!part) {
          throw new Error('Stock adjustment rejected: operation would result in negative stock or part not found.');
        }

        const [movement] = await StockMovement.create(
          [
            {
              part: part._id,
              movementType: parsed.movementType,
              quantityDelta: parsed.quantityDelta,
              balanceAfter: part.quantityOnHand,
              unitCostMinor:
                parsed.unitCostLkr !== undefined
                  ? toMinorUnits(parsed.unitCostLkr)
                  : part.purchaseCostMinor,
              unitPriceMinor: part.sellingPriceMinor,
              supplier: parsed.supplier || part.supplier || null,
              reason: parsed.reason,
              performedBy: req.user._id,
            },
          ],
          { session }
        );

        await AuditLog.create(
          [
            {
              action: `STOCK_${parsed.movementType}`,
              entityType: 'Part',
              entityId: String(part._id),
              summary: `${parsed.movementType} on ${part.sku} (${part.name}): ${parsed.quantityDelta > 0 ? '+' : ''}${parsed.quantityDelta} (New balance: ${part.quantityOnHand})`,
              metadata: {
                sku: part.sku,
                delta: parsed.quantityDelta,
                balanceAfter: part.quantityOnHand,
                reason: parsed.reason,
              },
              performedBy: req.user._id,
              performedByName: req.user.name,
              performedByRole: req.user.role,
            },
          ],
          { session }
        );

        return { part, movement };
      });

      emitDomainEvent('inventory', 'movementRecorded', { partId: result.part._id });
      emitDomainEvent('dashboard', 'refresh', {});
      return res.status(201).json({ data: result });
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/movements', requireAuth, requirePermission('MANAGE_INVENTORY_STOCK'), async (req, res, next) => {
  try {
    const query = {};
    if (req.query.partId) query.part = req.query.partId;
    const movements = await StockMovement.find(query)
      .populate('part', 'sku name unit')
      .populate('jobCard', 'jobNumber')
      .populate('supplier', 'name')
      .populate('performedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ data: movements });
  } catch (err) {
    return next(err);
  }
});

// Suppliers CRUD
router.get('/suppliers', requireAuth, async (_req, res, next) => {
  try {
    const suppliers = await Supplier.find({ isActive: true, isArchived: { $ne: true } }).sort({ name: 1 }).lean();
    return res.json({ data: suppliers });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/suppliers',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_INVENTORY_STOCK'),
  async (req, res, next) => {
    try {
      const created = await Supplier.create({
        name: req.body.name,
        contactPerson: req.body.contactPerson || '',
        phone: req.body.phone,
        email: req.body.email || '',
        address: req.body.address || '',
        notes: req.body.notes || '',
      });
      emitDomainEvent('suppliers', 'created', { id: created._id });
      return res.status(201).json({ data: created });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
