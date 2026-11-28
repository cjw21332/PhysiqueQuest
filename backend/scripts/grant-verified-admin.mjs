import 'dotenv/config';
import mongoose from 'mongoose';
import { grantVerifiedAdmin } from './admin-grant-core.mjs';

// Dry-run by default. The existing account's password is never changed.
const email = (process.env.PQ_ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = process.env.PQ_ADMIN_PASSWORD ?? '';
const secret = process.env.JWT_SECRET ?? '';
const uri = process.env.MONGODB_URI ?? '';
const hotDays = Number(process.env.AUDIT_LOG_HOT_DAYS ?? 90);
const months = Number(process.env.AUDIT_LOG_RETENTION_MONTHS ?? 12);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Set PQ_ADMIN_EMAIL to the verified existing account.');
if (!/^mongodb(?:\+srv)?:\/\//.test(uri) || secret.length < 32) throw new Error('Set MONGODB_URI and JWT_SECRET for the target backend.');
if (!password || Buffer.byteLength(password,'utf8') > 72) throw new Error('Set PQ_ADMIN_PASSWORD to the existing account password (at most 72 UTF-8 bytes).');
if (![months,hotDays].every(value=>Number.isSafeInteger(value)&&value>=1&&value<=3650)) throw new Error('Invalid audit retention configuration.');
await mongoose.connect(uri, {serverSelectionTimeoutMS:10000});
try {
  const outcome = await grantVerifiedAdmin(mongoose.connection, {email,password,secret,apply:process.env.PQ_ADMIN_APPLY === 'yes',hotDays,months});
  console.log(outcome === 'granted' ? 'Verified account is now an administrator. Existing sessions must sign in again.' : outcome === 'already-admin' ? 'The verified account is already an administrator; no changes were made.' : 'Verified account found. Dry run only; no changes were made.');
} finally { await mongoose.disconnect(); }
