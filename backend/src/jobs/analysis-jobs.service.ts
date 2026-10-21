import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, HttpException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../storage/storage.service.js';
import { FoodScanService } from '../foodscan/foodscan.service.js';
import { afterDays, assertJobPayload, retention } from '../privacy/retention.js';

@Injectable()
export class AnalysisJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalysisJobsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(@InjectConnection() private readonly connection: Connection, private readonly storage: StorageService, private readonly scanner: FoodScanService) {}
  private get jobs() { return this.connection.collection('analysis_jobs'); }
  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') await Promise.all([
      this.jobs.createIndex({ userId: 1, 'payload.resourceId': 1 }, { unique: true }),
      this.jobs.createIndex({ status: 1, createdAt: 1 }),
      this.jobs.createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
      this.connection.collection('analysis_results').createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
    this.timer = setInterval(() => { void this.tick().catch(() => this.logger.warn({ event: 'analysis_worker_failed' })); }, 1000); this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async enqueue(userId: string, uploadId: string) {
    const payload = { userId, resourceId: uploadId }; assertJobPayload(payload);
    const owner = new Types.ObjectId(userId);
    // Checking ownership never downloads media in the request path.
    await this.storage.download(uploadId, userId);
    const existing = await this.jobs.findOne({ userId: owner, 'payload.resourceId': uploadId });
    if (existing) return { id: String(existing._id), status: existing.status };
    if (await this.jobs.countDocuments({ userId: owner, status: { $in: ['pending', 'running'] } }) >= 3) throw new HttpException('Wait for your pending analyses.', 429);
    const _id = new Types.ObjectId();
    try { await this.jobs.insertOne({ _id, userId: owner, payload, status: 'pending', createdAt: new Date() }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; const row = await this.jobs.findOne({ userId: owner, 'payload.resourceId': uploadId }); if (!row) throw error; return { id: String(row._id), status: row.status }; }
    return { id: String(_id), status: 'pending' };
  }
  async status(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const job = await this.jobs.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }, { projection: { status: 1, code: 1, completedAt: 1 } });
    if (!job) throw new NotFoundException();
    const result = job.status === 'completed' ? await this.connection.collection('analysis_results').findOne({ _id: job._id, userId: new Types.ObjectId(userId) }, { projection: { result: 1 } }) : null;
    return { id, status: job.status, code: job.code, result: result?.result ?? null };
  }
  async tick() {
    if (this.busy) return; this.busy = true;
    try {
      const now = new Date();
      // Ambiguous paid-provider work is never automatically replayed after a crash.
      await this.jobs.updateMany({ status: 'running', lockedUntil: { $lte: now } }, { $set: { status: 'failed', code: 'ANALYSIS_INTERRUPTED', purgeAt: afterDays(now, retention('FAILED_JOB_TTL_DAYS')) } });
      const job = await this.jobs.findOneAndUpdate({ status: 'pending' }, { $set: { status: 'running', lockedUntil: new Date(Date.now() + 120_000), lease: randomUUID() } }, { returnDocument: 'after', sort: { createdAt: 1 } });
      if (!job) return;
      try {
        assertJobPayload(job.payload);
        const user = await this.connection.collection('users').findOne({ _id: job.userId, isActive: true });
        if (!user) throw new Error('Inactive user');
        const input = await this.storage.analysisInput(job.payload.resourceId, String(job.userId));
        const result = await this.scanner.analyze(input, String(job._id));
        const purgeAt = new Date(Date.now() + retention('COMPLETED_JOB_TTL_HOURS') * 3600_000);
        await this.storage.markAnalyzed(job.payload.resourceId, String(job.userId));
        const session = await this.connection.startSession();
        try { await session.withTransaction(async () => {
          // A user write serializes completion with deletion, preventing orphan result resurrection.
          const active = await this.connection.collection('users').updateOne({ _id: job.userId, isActive: true }, { $set: { lastAnalysisAt: new Date() } }, { session });
          if (!active.matchedCount) throw new Error('Inactive user');
          const finished = await this.jobs.updateOne({ _id: job._id, lease: job.lease, status: 'running' }, { $set: { status: 'completed', completedAt: new Date(), purgeAt }, $unset: { lease: '', lockedUntil: '' } }, { session });
          if (!finished.matchedCount) throw new Error('Job no longer active');
          await this.connection.collection('analysis_results').updateOne({ _id: job._id }, { $set: { userId: job.userId, result, purgeAt } }, { upsert: true, session });
        }); } finally { await session.endSession(); }
      } catch {
        await this.jobs.updateOne({ _id: job._id, lease: job.lease }, { $set: { status: 'failed', code: 'ANALYSIS_FAILED', purgeAt: afterDays(new Date(), retention('FAILED_JOB_TTL_DAYS')) }, $unset: { lease: '', lockedUntil: '' } });
      }
    } finally { this.busy = false; }
  }
}
