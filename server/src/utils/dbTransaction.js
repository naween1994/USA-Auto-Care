import mongoose from 'mongoose';

/**
 * Runs a callback inside a MongoDB ACID transaction when connected to a Replica Set / Atlas.
 * Ensures multi-document financial and inventory operations commit atomically BEFORE Socket.IO events emit.
 */
export async function withTransaction(workFn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await workFn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Optimistic concurrency version check helper.
 * Prevents stale client edits from silently overwriting newer database updates.
 */
export function assertVersionMatch(doc, clientVersion) {
  if (clientVersion !== undefined && clientVersion !== null) {
    const expected = Number(clientVersion);
    if (Number.isFinite(expected) && doc.__v !== expected) {
      const err = new Error(
        `Version conflict: this record was modified by another user (your version: v${expected}, current database version: v${doc.__v}). Please refresh before saving.`
      );
      err.statusCode = 409;
      err.code = 'VERSION_CONFLICT';
      throw err;
    }
  }
}
