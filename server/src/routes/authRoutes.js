import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { changePasswordSchema, loginSchema, staffUserSchema } from '../validators/schemas.js';
import {
  adminPasswordLimiter,
  requireAuth,
  requirePermission,
  requireAdminPassword,
  verifyCsrf,
  signAuthToken,
  generateCsrfToken,
  setAuthCookies,
  clearAuthCookies,
  CSRF_COOKIE_NAME,
} from '../middleware/auth.js';
import { emitDomainEvent } from '../socket/socketManager.js';
import { withTransaction } from '../utils/dbTransaction.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait 15 minutes before retrying.' },
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password change attempts. Please wait before retrying.' },
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    user.lastLoginAt = new Date();
    await user.save();

    const token = signAuthToken(user);
    const csrfToken = generateCsrfToken();
    setAuthCookies(res, token, csrfToken);

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      csrfToken,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', requireAuth, verifyCsrf, (req, res) => {
  clearAuthCookies(res);
  return res.json({ message: 'Logged out successfully' });
});

router.post('/change-password', passwordChangeLimiter, requireAuth, verifyCsrf, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.parse(req.body);
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Your account is no longer active. Please sign in again.' });
    }

    const valid = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(403).json({ message: 'Current password is incorrect.' });
    }
    if (await bcrypt.compare(parsed.newPassword, user.passwordHash)) {
      return res.status(400).json({ message: 'Choose a new password different from your current password.' });
    }

    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    await user.save();

    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  let csrfToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!csrfToken) {
    csrfToken = generateCsrfToken();
    const token = signAuthToken(req.user);
    setAuthCookies(res, token, csrfToken);
  }
  return res.json({
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      phone: req.user.phone,
    },
    csrfToken,
  });
});

// Staff list (for mechanics assignment and admin management)
router.get('/staff', requireAuth, async (req, res, next) => {
  try {
    const filter = req.query.role ? { role: req.query.role, isActive: true } : {};
    const staff = await User.find(filter).select('-passwordHash').sort({ name: 1 }).lean();
    return res.json({ data: staff });
  } catch (err) {
    return next(err);
  }
});

// Admin-only staff creation / role management (No public admin registration allowed)
router.post(
  '/staff',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  async (req, res, next) => {
    try {
      const parsed = staffUserSchema.parse(req.body);
      if (!parsed.password) {
        return res.status(400).json({ message: 'Initial password is required for new staff accounts' });
      }
      const passwordHash = await bcrypt.hash(parsed.password, 12);
      const created = await User.create({
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        passwordHash,
        role: parsed.role,
        phone: parsed.phone || '',
        isActive: parsed.isActive ?? true,
      });

      await AuditLog.create({
        action: 'STAFF_CREATED',
        entityType: 'User',
        entityId: String(created._id),
        summary: `Created staff user ${created.name} (${created.role})`,
        metadata: { email: created.email, role: created.role },
        performedBy: req.user._id,
        performedByName: req.user.name,
        performedByRole: req.user.role,
      });

      emitDomainEvent('staff', 'created', { id: created._id }, 'role:admin');
      return res.status(201).json({
        data: {
          _id: created._id,
          name: created.name,
          email: created.email,
          role: created.role,
          phone: created.phone,
          isActive: created.isActive,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.patch(
  '/staff/:id',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  async (req, res, next) => {
    try {
      const staff = await User.findById(req.params.id);
      if (!staff) return res.status(404).json({ message: 'Staff member not found' });
      if (req.body.isActive === false) {
        return res.status(400).json({ message: 'Use the password-confirmed deactivate action to disable a staff account.' });
      }

      const previousRole = staff.role;
      if (req.body.name) staff.name = req.body.name;
      if (req.body.phone !== undefined) staff.phone = req.body.phone;
      if (req.body.role) staff.role = req.body.role;
      if (req.body.isActive === true) staff.isActive = true;
      if (req.body.password && req.body.password.length >= 8) {
        staff.passwordHash = await bcrypt.hash(req.body.password, 12);
      }

      await staff.save();

      if (previousRole !== staff.role || req.body.isActive !== undefined) {
        await AuditLog.create({
          action: 'STAFF_ROLE_OR_STATUS_CHANGED',
          entityType: 'User',
          entityId: String(staff._id),
          summary: `Updated ${staff.name}: role ${previousRole} -> ${staff.role}, active=${staff.isActive}`,
          metadata: { previousRole, newRole: staff.role, isActive: staff.isActive },
          performedBy: req.user._id,
          performedByName: req.user.name,
          performedByRole: req.user.role,
        });
      }

      emitDomainEvent('staff', 'updated', { id: staff._id }, 'role:admin');
      return res.json({ data: staff });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/staff/:id',
  requireAuth,
  verifyCsrf,
  requirePermission('MANAGE_SETTINGS_AND_STAFF'),
  adminPasswordLimiter,
  requireAdminPassword,
  async (req, res, next) => {
    try {
      if (String(req.user._id) === req.params.id) {
        return res.status(400).json({ message: 'You cannot deactivate your own account.' });
      }

      const staff = await withTransaction(async (session) => {
        const target = await User.findById(req.params.id).session(session);
        if (!target) {
          const error = new Error('Staff member not found');
          error.statusCode = 404;
          throw error;
        }
        if (!target.isActive) {
          const error = new Error('This staff account is already inactive.');
          error.statusCode = 409;
          throw error;
        }

        if (target.role === 'admin') {
          const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true }).session(session);
          if (activeAdmins <= 1) {
            const error = new Error('The last active administrator account cannot be deactivated.');
            error.statusCode = 409;
            throw error;
          }
        }

        target.isActive = false;
        await target.save({ session });

        await AuditLog.create(
          [{
            action: 'STAFF_DEACTIVATED',
            entityType: 'User',
            entityId: String(target._id),
            summary: `Deactivated staff user ${target.name} (${target.role})`,
            metadata: { email: target.email, role: target.role },
            performedBy: req.user._id,
            performedByName: req.user.name,
            performedByRole: req.user.role,
          }],
          { session }
        );
        return target;
      });

      emitDomainEvent('staff', 'updated', { id: staff._id }, 'role:admin');
      return res.json({ message: 'Staff account deactivated. Its historical records have been retained.' });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
