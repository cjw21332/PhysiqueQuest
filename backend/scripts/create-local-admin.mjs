import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// This tool is deliberately restricted to a local development database.
const uri = process.env.MONGODB_URI ?? '';
const password = process.env.PQ_ADMIN_PASSWORD ?? '';
if (process.env.NODE_ENV !== 'development' || !/^mongodb:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/[a-zA-Z0-9_-]+(?:\?.*)?$/.test(uri)) {
  throw new Error('Set NODE_ENV=development and MONGODB_URI to a local MongoDB database.');
}
if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Set PQ_ADMIN_PASSWORD to a temporary password of at least 8 characters and at most 72 UTF-8 bytes.');
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
try {
  const db = mongoose.connection.db;
  const email = 'admin@localhost.invalid';
  if (await db.collection('users').findOne({ email })) {
    console.log('Local admin already exists; no account was modified.');
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const result = await db.collection('users').insertOne({ email, name: 'Administrator', passwordHash, role: 'admin', mustChangePassword: true, isActive: true, deletedAt: null, sessionVersion: 0, emailVerified: true, emailVerifiedAt: now, authPolicyVersion: 2, failedLoginAttempts: 0, lockoutUntil: null, createdAt: now, updatedAt: now }, { session });
        await db.collection('account_lifecycle').insertOne({ _id: result.insertedId, status: 'active', writeVersion: 0 }, { session });
      }, { writeConcern: { w: 'majority' } });
      console.log('Local admin created. A password change is required on first sign-in.');
    } finally { await session.endSession(); }
  }
} finally { await mongoose.disconnect(); }
