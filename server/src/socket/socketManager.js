import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ROLES } from '../utils/domainLogic.js';

let ioInstance = null;

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = decodeURIComponent(pair.slice(idx + 1).trim());
      acc[key] = val;
    }
    return acc;
  }, {});
}

export function initSocketServer(httpServer, allowedOrigin) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      credentials: true,
    },
  });

  // Authenticate every Socket.IO connection using the HTTP-only JWT cookie
  ioInstance.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie || '');
      const token = cookies.usa_autocare_token;
      if (!token) {
        return next(new Error('Authentication required for real-time stream'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.sub).lean();
      if (!user || !user.isActive) {
        return next(new Error('User account inactive or not found'));
      }
      socket.user = {
        id: String(user._id),
        name: user.name,
        role: user.role,
      };
      return next();
    } catch (err) {
      return next(new Error('Invalid or expired session token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const { role, id } = socket.user;

    // Join role-restricted rooms so financial events are never broadcast to unauthorized roles
    socket.join('authenticated');
    socket.join(`role:${role}`);
    socket.join(`user:${id}`);

    if ([ROLES.ADMIN, ROLES.CASHIER, ROLES.RECEPTIONIST].includes(role)) {
      socket.join('scope:financial');
    }
    if ([ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.MECHANIC].includes(role)) {
      socket.join('scope:workshop');
    }

    socket.emit('socket:authenticated', {
      userId: id,
      role,
      serverTime: new Date().toISOString(),
    });
  });

  return ioInstance;
}

/**
 * Emit a real-time invalidation/update event ONLY AFTER a successful MongoDB commit.
 * Automatically scopes events to authorized rooms.
 */
export function emitDomainEvent(entity, action, payload = {}, scope = 'authenticated') {
  if (!ioInstance) return;
  const eventPayload = {
    entity,
    action,
    payload,
    timestamp: new Date().toISOString(),
  };
  ioInstance.to(scope).emit('domain:updated', eventPayload);
}
