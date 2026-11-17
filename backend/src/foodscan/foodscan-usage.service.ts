import { Injectable, Logger, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Types, type Connection } from 'mongoose';
import { AppError, ErrorCode, serviceUnavailable } from '../common/foodscan/errors.js';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';

export type TokenUsage = { input: number | null; output: number | null; total: number | null };
type UsageRecord = { _id: string; userId: Types.ObjectId; generation?: number; requestId: string; createdAt: Date; model: string; provider: string; status: string; usageAvailable: boolean; usageComplete: boolean; input: number | null; output: number | null; total: number | null; estimatedCost: null; errorCategory?: string; resolvedAt?: Date; reconciledAt?: Date };

@Injectable()
export class FoodScanUsageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FoodScanUsageService.name);
  private indexReady?: Promise<unknown>;
  private timer?: ReturnType<typeof setInterval>;
  private failedWrites = 0;
  constructor(@Optional() @InjectConnection() private readonly connection?: Connection) {}
  private collection() {
    if (!this.connection?.db) throw serviceUnavailable('Scan usage tracking is temporarily unavailable');
    return this.connection.db.collection<UsageRecord>('food_scan_usage');
  }
  private async ensureIndex() {
    try { this.indexReady ??= Promise.all([this.collection().createIndex({ userId: 1, createdAt: -1 }, { maxTimeMS: 2000 }), this.collection().createIndex({ status: 1, createdAt: 1 }, { maxTimeMS: 2000 })]); await this.indexReady; }
    catch { this.indexReady = undefined; throw serviceUnavailable('Scan usage tracking is temporarily unavailable'); }
  }
  onModuleInit() {
    if (!this.connection) return;
    this.timer = setInterval(() => { void this.maintain().catch(() => this.logger.warn('scan_usage_maintenance_failed')); }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  private configInt(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name]; if (!raw) return fallback;
    const value = Number(raw); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
    return value;
  }
  async maintain(now = new Date()) {
    const staleMinutes = this.configInt('FOODSCAN_USAGE_STALE_MINUTES', 30, 10, 10080);
    const retentionDays = this.configInt('FOODSCAN_USAGE_RETENTION_DAYS', 90, 1, 3650);
    const records = this.collection();
    const stale = { status: 'pending', createdAt: { $lte: new Date(now.getTime() - staleMinutes * 60_000) } };
    const expired = { status: { $in: ['success', 'failure'] }, usageComplete: true, resolvedAt: { $lte: new Date(now.getTime() - retentionDays * 86400_000) } };
    const reconciled = { modifiedCount: 0 }, removed = { deletedCount: 0 };
    // Legacy records are quarantined in place for the offline audit. Never
    // assign today's generation to old provider work.
    for await (const record of records.find({ $or: [stale, expired], generation: { $gte: 0 } }).limit(500)) {
      try {
        const result = await new AccountLifecycleFence(this.connection!).withActiveWrite(String(record.userId), async session => {
          if (record.status === 'pending') return { reconciled: (await records.updateOne({ _id: record._id, ...stale },
            { $set: { status: 'incomplete', usageComplete: false, errorCategory: 'outcome_unknown', reconciledAt: now } }, { session })).modifiedCount, removed: 0 };
          return { reconciled: 0, removed: (await records.deleteOne({ _id: record._id, ...expired }, { session })).deletedCount };
        }, record.generation);
        reconciled.modifiedCount += result.reconciled; removed.deletedCount += result.removed;
      } catch { this.logger.warn('scan_usage_reconciliation_deferred'); }
    }
    const [pending, incomplete, oldest] = await Promise.all([
      records.countDocuments({ status: 'pending' }, { maxTimeMS: 2000 }),
      records.countDocuments({ status: 'incomplete' }, { maxTimeMS: 2000 }),
      records.find({ status: { $in: ['pending', 'incomplete'] } }, { projection: { createdAt: 1 }, maxTimeMS: 2000 }).sort({ createdAt: 1 }).limit(1).next(),
    ]);
    const oldestAge = oldest?.createdAt ? Math.max(0, now.getTime() - oldest.createdAt.getTime()) : 0;
    this.logger.log(`scan_usage_maintenance reconciled=${reconciled.modifiedCount} removed=${removed.deletedCount} pending=${pending} incomplete=${incomplete} oldest_unresolved_ms=${oldestAge} failed_completion_writes_process=${this.failedWrites}`);
    return { reconciled: reconciled.modifiedCount, removed: removed.deletedCount };
  }
  async begin(userId: string, requestId: string, model: string): Promise<string> {
    const id = createHash('sha256').update(JSON.stringify([userId, requestId])).digest('hex');
    const owner = new Types.ObjectId(userId);
    try {
      await this.ensureIndex();
      const fence = new AccountLifecycleFence(this.connection!);
      const generation = await fence.generation(userId);
      await fence.withActiveWrite(userId, async session => {
        await this.collection().insertOne({ _id: id, userId: owner, generation, requestId, createdAt: new Date(), model, provider: 'openai', status: 'pending', usageAvailable: false, usageComplete: false, input: null, output: null, total: null, estimatedCost: null }, { maxTimeMS: 2000, session });
      }, generation);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new AppError(ErrorCode.INVALID_REQUEST, 'This scan request was already submitted. Start a new scan to try again.');
      throw serviceUnavailable('Scan usage tracking is temporarily unavailable');
    }
    return id;
  }
  async finish(id: string, status: 'success' | 'failure', usage: TokenUsage | null, errorCategory?: string, complete = true): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const record = await this.collection().findOne({ _id: id }, { projection: { userId: 1, generation: 1 } });
        if (!record) throw new Error('Usage reservation is unavailable');
        if (!Number.isSafeInteger(record.generation)) throw new Error('Usage reservation has no lifecycle generation');
        await new AccountLifecycleFence(this.connection!).withActiveWrite(String(record.userId), async session => {
          await this.collection().updateOne({ _id: id, userId: record.userId, generation: record.generation, status: { $in: ['pending', 'incomplete'] } }, { $set: { status, resolvedAt: new Date(), usageAvailable: usage !== null, usageComplete: complete && usage !== null && Object.values(usage).every(value => value !== null), input: usage?.input ?? null, output: usage?.output ?? null, total: usage?.total ?? null, ...(errorCategory ? { errorCategory } : {}) }, $unset: { reconciledAt: '', ...(!errorCategory ? { errorCategory: '' } : {}) } }, { maxTimeMS: 2000, session });
        }, record.generation);
        return;
      } catch { if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    this.failedWrites++;
    this.logger.error('scan_usage_update_failed');
    throw serviceUnavailable('Scan usage tracking is temporarily unavailable');
  }
  async summary(userId: string) {
    try {
      await this.ensureIndex();
      const result = await this.collection().aggregate([{ $match: { userId: new Types.ObjectId(userId) } }, { $group: { _id: null, scans: { $sum: 1 }, successful: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }, usage_available: { $sum: { $cond: ['$usageAvailable', 1, 0] } }, usage_complete: { $sum: { $cond: ['$usageComplete', 1, 0] } }, input_tokens: { $sum: '$input' }, output_tokens: { $sum: '$output' }, total_tokens: { $sum: '$total' }, input_known: { $sum: { $cond: [{ $isNumber: '$input' }, 1, 0] } }, output_known: { $sum: { $cond: [{ $isNumber: '$output' }, 1, 0] } }, total_known: { $sum: { $cond: [{ $isNumber: '$total' }, 1, 0] } } } }], { maxTimeMS: 2000 }).toArray();
      const { _id: _, ...totals } = result[0] ?? { scans: 0, successful: 0, failed: 0, pending: 0, usage_available: 0, usage_complete: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, input_known: 0, output_known: 0, total_known: 0 };
      return { ...totals, incomplete: totals.scans - totals.successful - totals.failed - totals.pending, input_tokens: totals.input_known ? totals.input_tokens : null, output_tokens: totals.output_known ? totals.output_tokens : null, total_tokens: totals.total_known ? totals.total_tokens : null, estimated_cost: null, cost_status: 'unavailable', token_totals_are_partial: totals.usage_complete < totals.scans };
    } catch { throw serviceUnavailable('Scan usage tracking is temporarily unavailable'); }
  }
}
