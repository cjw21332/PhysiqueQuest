import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, HttpException } from '@nestjs/common';
import { OPENAI_MODEL } from '../common/openai.js';
import { InjectConnection } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../storage/storage.service.js';
import { FoodScanService } from '../foodscan/foodscan.service.js';
import { afterDays, assertJobPayload, retention } from '../privacy/retention.js';
import { FoodScanUsageService, type TokenUsage } from '../foodscan/foodscan-usage.service.js';
import { FoodScanConfigService } from '../common/foodscan/foodscan-config.js';
import { AppError } from '../common/foodscan/errors.js';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';
import { lifecycleContext } from '../privacy/lifecycle-context.js';

@Injectable()
export class AnalysisJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalysisJobsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(@InjectConnection() private readonly connection: Connection, private readonly storage: StorageService, private readonly scanner: FoodScanService, private readonly usage: FoodScanUsageService, private readonly scanConfig: FoodScanConfigService) {}
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
    const fence = new AccountLifecycleFence(this.connection);
    const generation = await fence.generation(userId);
    // Checking ownership never downloads media in the request path.
    await this.storage.download(uploadId, userId);
    return fence.withActiveWrite(userId, async session => {
    const existing = await this.jobs.findOne({ userId: owner, 'payload.resourceId': uploadId }, { session });
    if (existing) {
      if (existing.generation !== generation) throw new HttpException('This analysis belongs to an earlier account session. Upload the image again.', 409);
      return { id: String(existing._id), status: existing.status };
    }
    if (await this.jobs.countDocuments({ userId: owner, status: { $in: ['pending', 'running'] } }, { session }) >= 3) throw new HttpException('Wait for your pending analyses.', 429);
    const _id = new Types.ObjectId();
    await this.jobs.insertOne({ _id, userId: owner, generation, payload, status: 'pending', createdAt: new Date() }, { session });
    return { id: String(_id), status: 'pending' };
    }, generation);
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
      const fence = new AccountLifecycleFence(this.connection);
      for (const expired of await this.candidates({ status: 'running', lockedUntil: { $lte: now } })) {
        await fence.withActiveWrite(String(expired.userId), async session => {
          await this.jobs.updateOne({ _id: expired._id, status: 'running', lockedUntil: { $lte: now } }, { $set: { status: 'failed', code: 'ANALYSIS_INTERRUPTED', purgeAt: afterDays(now, retention('FAILED_JOB_TTL_DAYS')) }, $unset: { lease: '', lockedUntil: '' } }, { session });
        }, expired.generation).catch(() => this.logger.warn({ event: 'analysis_expiration_deferred' }));
      }
      let job;
      for (const candidate of await this.candidates({ status: 'pending' })) {
        job = await fence.withActiveWrite(String(candidate.userId), async session => this.jobs.findOneAndUpdate({ _id: candidate._id, status: 'pending', generation: candidate.generation }, { $set: { status: 'running', lockedUntil: new Date(Date.now() + 120_000), lease: randomUUID() } }, { session, returnDocument: 'after' }), candidate.generation)
          .catch(() => null);
        if (job) break;
      }
      if (!job) return;
      try {
        assertJobPayload(job.payload);
        if (!Number.isSafeInteger(job.generation)) throw new Error('Job lifecycle generation unavailable');
        const fence = new AccountLifecycleFence(this.connection);
        if (await fence.generation(String(job.userId)) !== job.generation) throw new Error('Stale job');
        const user = await this.connection.collection('users').findOne({ _id: job.userId, isActive: true });
        if (!user) throw new Error('Inactive user');
        const input = await this.storage.analysisInput(job.payload.resourceId, String(job.userId));
        const usageId = await lifecycleContext.run({ userId: String(job.userId), generation: job.generation },
          () => this.usage.begin(String(job.userId), `job:${job._id}`, OPENAI_MODEL));
        let observed: TokenUsage | null = null, incomplete = false;
        let result;
        try {
          result = await this.scanner.analyze(input, String(job._id), value => {
            if (!value) { incomplete = true; return; }
            if (!observed) observed = value;
            else { const add = (a: number | null, b: number | null) => a === null || b === null ? null : a + b;
              observed = { input: add(observed.input, value.input), output: add(observed.output, value.output), total: add(observed.total, value.total) }; }
          });
          await this.usage.finish(usageId, 'success', observed, undefined, !incomplete);
        } catch (error) {
          await this.usage.finish(usageId, 'failure', observed, error instanceof AppError ? error.code : 'invalid_or_internal', !incomplete);
          throw error;
        }
        const purgeAt = new Date(Date.now() + retention('COMPLETED_JOB_TTL_HOURS') * 3600_000);
        await fence.withActiveWrite(String(job.userId), async session => {
          await this.storage.markAnalyzed(job.payload.resourceId, String(job.userId), job.generation, session);
          // A user write serializes completion with deletion, preventing orphan result resurrection.
          const active = await this.connection.collection('users').updateOne({ _id: job.userId, isActive: true }, { $set: { lastAnalysisAt: new Date() } }, { session });
          if (!active.matchedCount) throw new Error('Inactive user');
          const finished = await this.jobs.updateOne({ _id: job._id, lease: job.lease, status: 'running' }, { $set: { status: 'completed', completedAt: new Date(), purgeAt }, $unset: { lease: '', lockedUntil: '' } }, { session });
          if (!finished.matchedCount) throw new Error('Job no longer active');
          await this.connection.collection('analysis_results').updateOne({ _id: job._id }, { $set: { userId: job.userId, result, purgeAt } }, { upsert: true, session });
        }, job.generation);
      } catch {
        await fence.withActiveWrite(String(job.userId), async session => {
          await this.jobs.updateOne({ _id: job._id, lease: job.lease, status: 'running' }, { $set: { status: 'failed', code: 'ANALYSIS_FAILED', purgeAt: afterDays(new Date(), retention('FAILED_JOB_TTL_DAYS')) }, $unset: { lease: '', lockedUntil: '' } }, { session });
        }, job.generation).catch(() => this.logger.warn({ event: 'analysis_failure_invalidated' }));
      }
    } finally { this.busy = false; }
  }
  private candidates(filter: Record<string, unknown>) {
    // The lookup avoids repeatedly selecting quarantined legacy/stale jobs.
    // The transaction still revalidates the lifecycle at the actual mutation.
    return this.jobs.aggregate([
      { $match: { ...filter, generation: { $gte: 0 } } },
      { $lookup: { from: 'account_lifecycle', localField: 'userId', foreignField: '_id', as: 'lifecycle' } },
      { $unwind: '$lifecycle' },
      { $match: { 'lifecycle.status': 'active', $expr: { $eq: ['$generation', { $ifNull: ['$lifecycle.generation', 0] }] } } },
      { $sort: { createdAt: 1 } }, { $limit: 100 }, { $unset: 'lifecycle' },
    ]).toArray();
  }
}
