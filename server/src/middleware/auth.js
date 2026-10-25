import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { hasPermission } from '../utils/domainLogic.js';

export const TOKEN_COOKIE_NAME = 'usa_autocare_token';
export const CSRF_COOKIE_NAME = 'usa_autocare_csrf';

export function signAuthToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function setAuthCookies(res, token, csrfToken) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Readable by same-origin SPA to attach X-CSRF-Token header
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie(TOKEN_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[TOKEN_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required. Please sign in.' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) {
      clearAuthCookies(res);
      return res.status(401).json({ message: 'User session is no longer active.' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session. Please sign in again.' });
  }
}

/**
 * Double-Submit Cookie CSRF protection for state-mutating HTTP requests.
 */
export function verifyCsrf(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      message: 'CSRF token validation failed. Please refresh your session.',
    });
  }
  return next();
}

export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user.role, permissionKey)) {
      return res.status(403).json({
        message: 'Access denied: your role does not have permission for this action.',
      });
    }
    return next();
  };
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access restricted to roles: ${roles.join(', ')}`,
      });
    }
    return next();
  };
}
