import type { Connection } from 'mongoose';

/** Runs before HTTP listening or scheduled workers start. No standalone fallback. */
export async function assertLifecycleReadiness(connection: Connection) {
  const db = connection.db;
  if (!db) throw new Error('Lifecycle startup: database unavailable');
  const hello = await db.admin().command({ hello: 1 });
  if ((!hello.setName && hello.msg !== 'isdbgrid') || !hello.logicalSessionTimeoutMinutes) {
    throw new Error('Lifecycle startup requires a transaction-capable replica set or sharded cluster');
  }
  await db.collection('account_lifecycle').createIndex({ status: 1 });
  await db.collection('analysis_jobs').createIndex({ userId: 1, 'payload.resourceId': 1 }, { unique: true });
  await db.collection('background_jobs').createIndex({ key: 1 }, { unique: true });
  await db.collection('storage_cleanup').createIndex({ runAt: 1 });
  const missing = await db.collection('users').aggregate([
    { $lookup: { from: 'account_lifecycle', localField: '_id', foreignField: '_id', as: 'lifecycle' } },
    { $match: { 'lifecycle.0': { $exists: false } } }, { $limit: 1 },
  ]).hasNext();
  if (missing) throw new Error('Lifecycle startup blocked: existing accounts require the offline lifecycle migration');
  const inconsistent = await db.collection('users').aggregate([
    { $lookup: { from: 'account_lifecycle', localField: '_id', foreignField: '_id', as: 'lifecycle' } },
    { $unwind: '$lifecycle' },
    { $match: { $or: [
      { 'lifecycle.status': 'deleted' },
      { 'lifecycle.status': 'active', $or: [{ isActive: { $ne: true } }, { deletedAt: { $ne: null } }, { purgingAt: { $ne: null } }] },
      { 'lifecycle.status': 'deleting', $or: [{ isActive: { $ne: false } }, { deletedAt: { $not: { $type: 'date' } } }] },
    ] } }, { $limit: 1 },
  ]).hasNext();
  if (inconsistent) throw new Error('Lifecycle startup blocked: account and lifecycle states disagree');
  const invalid = await db.collection('account_lifecycle').findOne({ $or: [
    { status: { $nin: ['active', 'deleting', 'deleted'] } },
    { generation: { $exists: true, $not: { $gte: 0 } } },
  ] });
  if (invalid) throw new Error('Lifecycle startup blocked: invalid lifecycle state');
  // An aborted write proves actual transaction capability without mutating an account.
  const session = await connection.startSession();
  try {
    session.startTransaction({ writeConcern: { w: 'majority' } });
    await db.collection('account_lifecycle').updateOne({ _id: null as never }, { $inc: { writeVersion: 1 } }, { session });
    await session.abortTransaction();
  } finally { await session.endSession(); }
}
