import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import { createHmac, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { afterDays, assertJobPayload, auditExpiry, retention } from './retention.js';
import { decryptProfile } from './health-encryption.js';
import { StorageService } from '../storage/storage.service.js';

const generic = () => new UnauthorizedException('Unable to recover account');

@Injectable()
export class PrivacyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrivacyService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(@InjectConnection() private readonly connection: Connection, private readonly storage: StorageService) {}
  private get db() {
    if (!this.connection.db) throw new Error('Database unavailable');
    return this.connection.db;
  }

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') await Promise.all([
      this.db.collection('background_jobs').createIndex({ key: 1 }, { unique: true }),
      this.db.collection('background_jobs').createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
      this.db.collection('background_jobs').createIndex({ status: 1, runAt: 1, lockedUntil: 1 }),
      this.db.collection('audit_logs').createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
      this.db.collection('audit_logs').createIndex({ actorId: 1, occurredAt: -1 }),
      this.db.collection('audit_logs').createIndex({ hotUntil: 1, cold: 1 }),
      this.db.collection('audit_logs').createIndex({ actorId: 1, action: 1 }, { unique: true, partialFilterExpression: { action: 'account_purged' } }),
    ]);
    this.timer = setInterval(() => { void this.tick().catch(() => this.logger.error({ event: 'retention_cleanup_failed' })); }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async audit(event: { actorId?: string; action: string; requestId?: string; status?: number; ip?: string; counts?: Record<string, number> }) {
    const now = new Date();
    const pseudonym = (value: string) => createHmac('sha256', process.env.JWT_SECRET!).update(value).digest('hex');
    await this.db.collection('audit_logs').insertOne({
      actorId: event.actorId, action: event.action.slice(0, 160), requestId: event.requestId,
      status: event.status, ipHash: event.ip ? pseudonym(event.ip) : undefined, counts: event.counts,
      occurredAt: now, hotUntil: afterDays(now, retention('AUDIT_LOG_HOT_DAYS')), cold: false, purgeAt: auditExpiry(now),
    });
  }

  async enqueue(key: string, kind: 'account-purge', payload: Record<string, unknown>, runAt: Date) {
    assertJobPayload(payload);
    await this.db.collection('background_jobs').updateOne({ key }, { $setOnInsert: {
      key, kind, payload, runAt, status: 'pending', attempts: 0, createdAt: new Date(),
    } }, { upsert: true });
  }

  async requestDeletion(userId: string, password: string) {
    const id = new Types.ObjectId(userId);
    const user = await this.db.collection('users').findOne({ _id: id, isActive: true, deletedAt: null });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) throw new UnauthorizedException('Invalid password');
    const now = new Date(), purgeAfter = afterDays(now, retention('ACCOUNT_DELETION_GRACE_DAYS'));
    const result = await this.db.collection('users').updateOne({ _id: id, isActive: true, deletedAt: null }, {
      $set: { deletedAt: now, purgeAfter, purgingAt: null, isActive: false, updatedAt: now }, $inc: { sessionVersion: 1 },
    });
    if (result.modifiedCount) {
      await this.db.collection('auth_sessions').updateMany({ userId: id }, { $set: { revokedAt: now } });
      await this.db.collection('password_recovery_tokens').deleteMany({ userId: id });
      await this.audit({ actorId: userId, action: 'account_deletion_requested' });
    }
    // The worker discovers deleted users, including after a crash in this request.
    return { deleted: true, purgeAfter };
  }

  async recover(email: string, password: string) {
    const user = await this.db.collection('users').findOne({ email: email.trim().toLowerCase(), deletedAt: { $type: 'date' }, purgeAfter: { $gt: new Date() }, purgingAt: null });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) throw generic();
    const result = await this.db.collection('users').updateOne({ _id: user._id, deletedAt: user.deletedAt, purgeAfter: { $gt: new Date() }, purgingAt: null }, {
      $set: { isActive: true, deletedAt: null, purgeAfter: null, failedLoginAttempts: 0, lockoutUntil: null, updatedAt: new Date() }, $inc: { sessionVersion: 1 },
    });
    if (!result.modifiedCount) throw generic();
    await this.audit({ actorId: String(user._id), action: 'account_recovered' });
    return { recovered: true };
  }

  async exportData(userId: string) {
    const id = new Types.ObjectId(userId);
    const user = await this.db.collection('users').findOne({ _id: id, isActive: true }, { projection: { passwordHash: 0, sessionVersion: 0, failedLoginAttempts: 0, lockoutUntil: 0 } });
    if (!user) throw new UnauthorizedException();
    const data: Record<string, unknown> = { user };
    for (const { name } of await this.db.listCollections({}, { nameOnly: true }).toArray()) {
      if (['users', 'audit_logs', 'background_jobs', 'password_recovery_tokens', 'email_verifications', 'auth_sessions', 'push_devices'].includes(name) || name.startsWith('system.')) continue;
      const records = await this.db.collection(name).find({ $or: [{ userId: id }, { subjectId: id }] }).toArray();
      if (name === 'profiles') records.forEach(record => decryptProfile(record));
      if (records.length) data[name] = records;
    }
    await this.audit({ actorId: userId, action: 'account_exported' });
    return { exportedAt: new Date(), data };
  }

  async purgeUser(userId: string, now = new Date()) {
    const id = new Types.ObjectId(userId);
    // This claim blocks recovery before any collection is touched; retries may reclaim it.
    const user = await this.db.collection('users').findOneAndUpdate({ _id: id, deletedAt: { $type: 'date' }, purgeAfter: { $lte: now }, isActive: false }, { $set: { purgingAt: now } }, { returnDocument: 'after' });
    if (!user) return {};
    await this.storage.deleteUserObjects(userId);
    const counts: Record<string, number> = {};
    for (const { name } of await this.db.listCollections({}, { nameOnly: true }).toArray()) {
      if (['users', 'audit_logs', 'background_jobs'].includes(name) || name.startsWith('system.')) continue;
      const result = await this.db.collection(name).deleteMany({ $or: [{ userId: id }, { subjectId: id }, { userId }, { subjectId: userId }] });
      if (result.deletedCount) counts[name] = result.deletedCount;
    }
    const pseudonym = `deleted:${createHmac('sha256', process.env.JWT_SECRET!).update(userId).digest('hex')}`;
    await this.db.collection('audit_logs').updateMany({ actorId: userId }, { $set: { actorId: pseudonym }, $unset: { ipHash: '' } });
    // Upsert keeps the deletion event idempotent after a crash before the user delete.
    const expiry = auditExpiry(now);
    await this.db.collection('audit_logs').updateOne({ action: 'account_purged', actorId: pseudonym }, { $setOnInsert: { action: 'account_purged', actorId: pseudonym, counts, occurredAt: now, hotUntil: afterDays(now, retention('AUDIT_LOG_HOT_DAYS')), cold: false, purgeAt: expiry } }, { upsert: true });
    await this.db.collection('users').deleteOne({ _id: id, purgingAt: { $ne: null }, isActive: false });
    await this.db.collection('background_jobs').updateMany({ 'payload.userId': userId }, { $set: { payload: {} } });
    this.logger.log({ event: 'account_purged', counts });
    return counts;
  }

  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      // Reconciles a crash after soft deletion or a lost queue insert.
      for (const user of await this.db.collection('users').find({ deletedAt: { $type: 'date' }, purgeAfter: { $lte: now }, isActive: false }).limit(100).toArray()) {
        const key = createHmac('sha256', process.env.JWT_SECRET!).update(`${user._id}:${new Date(user.deletedAt).toISOString()}`).digest('hex');
        await this.enqueue(key, 'account-purge', { userId: String(user._id) }, now);
      }
      for (let i = 0; i < 100; i++) {
        const lease = randomUUID();
        const job = await this.db.collection('background_jobs').findOneAndUpdate({ runAt: { $lte: now }, $or: [{ status: 'pending' }, { status: 'running', lockedUntil: { $lte: now } }] }, {
          $set: { status: 'running', lockedUntil: afterDays(now, 1 / 24), lease }, $inc: { attempts: 1 },
        }, { returnDocument: 'after' });
        if (!job) break;
        try {
          assertJobPayload(job.payload);
          if (job.kind !== 'account-purge') throw new Error('Unsupported job kind');
          if (job.payload.userId) await this.purgeUser(job.payload.userId, now);
          await this.db.collection('background_jobs').updateOne({ _id: job._id, lease }, { $set: { status: 'completed', payload: {}, completedAt: now, purgeAt: new Date(now.getTime() + retention('COMPLETED_JOB_TTL_HOURS') * 3600_000) }, $unset: { lease: '', lockedUntil: '' } });
        } catch {
          const failed = job.attempts >= 5;
          await this.db.collection('background_jobs').updateOne({ _id: job._id, lease }, { $set: failed
            ? { status: 'failed', failedAt: now, purgeAt: afterDays(now, retention('FAILED_JOB_TTL_DAYS')) }
            : { status: 'pending', runAt: new Date(now.getTime() + Math.min(3600_000, 1000 * 2 ** job.attempts) + Math.random() * 1000) }, $unset: { lease: '', lockedUntil: '' } });
          this.logger.warn({ event: 'background_job_failed', attempts: job.attempts });
        }
      }
      const cold = await this.db.collection('audit_logs').updateMany({ hotUntil: { $lte: now }, cold: false }, { $set: { cold: true } });
      const audit = await this.db.collection('audit_logs').deleteMany({ purgeAt: { $lte: now } });
      const jobs = await this.db.collection('background_jobs').deleteMany({ purgeAt: { $lte: now } });
      const sessions = await this.db.collection('auth_sessions').deleteMany({ purgeAt: { $lte: now } });
      this.logger.log({ event: 'retention_cleanup', auditCold: cold.modifiedCount, auditPurged: audit.deletedCount, jobsPurged: jobs.deletedCount, sessionsPurged: sessions.deletedCount });
    } finally { this.running = false; }
  }
}
