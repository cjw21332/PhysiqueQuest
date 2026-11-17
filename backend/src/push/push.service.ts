import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notifications } from '../notifications/schemas/notification.schema.js';
import { retention } from '../privacy/retention.js';
import { DryRunPushProvider, ExpoPushProvider, type PushProvider } from './push.provider.js';
import { PushDelivery, PushDevice } from './push.schema.js';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';
import type { ClientSession } from 'mongoose';

export const isExpoToken = (value: string) => /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(value);

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly provider: PushProvider = process.env.PUSH_PROVIDER === 'expo' ? new ExpoPushProvider() : new DryRunPushProvider();
  constructor(
    @InjectModel(PushDevice.name) private readonly devices: Model<PushDevice>,
    @InjectModel(PushDelivery.name) private readonly deliveries: Model<PushDelivery>,
    @InjectModel(Notifications.name) private readonly notifications: Model<Notifications>,
  ) {}

  onModuleInit() { this.timer = setInterval(() => { void this.tick(); }, 15000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async register(userId: string, deviceId: string, token: string) {
    if (!isExpoToken(token) || !/^[a-zA-Z0-9_-]{16,128}$/.test(deviceId)) throw new BadRequestException('Invalid push device');
    // A token cannot silently move between accounts; logout must revoke its old registration.
    const existing = await this.devices.findOne({ token }).select('userId');
    if (existing && String(existing.userId) !== userId) throw new BadRequestException('Push device already registered');
    try {
      const owner = new Types.ObjectId(userId);
      const current = await this.devices.findOne({ userId: owner, deviceId }).select('+token');
      if (!current && await this.devices.countDocuments({ userId: owner }) >= 20) throw new BadRequestException('Too many registered push devices');
      await new AccountLifecycleFence(this.devices.db).withActiveWrite(userId, async session => this.devices.findOneAndUpdate({ userId: owner, deviceId }, { $set: { token, version: current?.token === token ? current.version : new Types.ObjectId() } }, { upsert: true, session }));
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new BadRequestException('Push device already registered');
      throw error;
    }
    return { registered: true, mode: process.env.PUSH_PROVIDER === 'expo' ? 'expo' : 'dry-run' };
  }

  async revoke(userId: string, deviceId: string) {
    await new AccountLifecycleFence(this.devices.db).withActiveWrite(userId, async session => {
      const device = await this.devices.findOneAndDelete({ userId: new Types.ObjectId(userId), deviceId }, { session });
      if (device) await this.deliveries.deleteMany({ userId: device.userId, deviceId: device._id }, { session });
    });
    return { revoked: true };
  }

  async enqueue(userId: string, notificationId: string) {
    const fence = new AccountLifecycleFence(this.devices.db), generation = await fence.generation(userId);
    const owner = new Types.ObjectId(userId);
    if (!await this.notifications.exists({ userId: owner, 'items.id': notificationId })) throw new NotFoundException('Notification not found');
    const devices = await this.devices.find({ userId: owner }).select('_id version').lean();
    await fence.withActiveWrite(userId, async session => { for (const device of devices) {
      await this.deliveries.updateOne({ notificationId, deviceId: device._id }, { $setOnInsert: {
        userId: owner, generation, deviceId: device._id, deviceVersion: device.version, notificationId, status: 'pending', attempts: 0, runAt: new Date(),
      } }, { upsert: true, session });
    } }, generation);
    return { queued: devices.length };
  }

  private async mutate<T>(id: Types.ObjectId, write: (session: ClientSession) => Promise<T>): Promise<T> {
    const job = await this.deliveries.findById(id).lean();
    if (!job || !Number.isSafeInteger(job.generation)) throw new NotFoundException('Delivery is unavailable');
    return new AccountLifecycleFence(this.deliveries.db).withActiveWrite(String(job.userId), write, job.generation);
  }
  private finish(id: Types.ObjectId, failed: boolean, outcome: string) {
    const hours = failed ? retention('FAILED_JOB_TTL_DAYS') * 24 : retention('COMPLETED_JOB_TTL_HOURS');
    return this.mutate(id, async session => this.deliveries.updateOne({ _id: id }, { $set: {
      status: failed ? 'failed' : 'completed', outcome, expiresAt: new Date(Date.now() + hours * 3600000),
    }, $unset: { receiptId: 1 } }, { session }));
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      // A send interrupted before its receipt is durably saved must never be
      // replayed automatically: the external provider may have accepted it.
      for (const abandoned of await this.deliveries.find({ status: 'sending', runAt: { $lte: new Date() }, generation: { $gte: 0 } }).limit(100).lean()) {
        await this.finish(abandoned._id, true, 'outcome-unknown').catch(() => this.logger.warn('Push completion invalidated'));
      }
      // CAS lease also allows another process to resume work after a crash.
      for (let count = 0; count < 20; count++) {
        const candidates = await this.deliveries.aggregate([
          { $match: { status: { $in: ['pending', 'receipt'] }, runAt: { $lte: new Date() }, generation: { $gte: 0 } } },
          { $lookup: { from: 'account_lifecycle', localField: 'userId', foreignField: '_id', as: 'lifecycle' } },
          { $unwind: '$lifecycle' }, { $match: { 'lifecycle.status': 'active', $expr: { $eq: ['$generation', { $ifNull: ['$lifecycle.generation', 0] }] } } },
          { $sort: { runAt: 1 } }, { $limit: 1 },
        ]);
        const candidate = candidates[0];
        if (!candidate) break;
        const job = await this.mutate(candidate._id, async session => this.deliveries.findOneAndUpdate({ _id: candidate._id, status: candidate.status, runAt: candidate.runAt },
          { $set: { status: candidate.status === 'pending' ? 'sending' : 'receipt', runAt: new Date(Date.now() + 60000) }, $inc: { attempts: 1 } }, { returnDocument: 'after', session }).lean());
        if (!job) break;
        try {
          const device = await this.devices.findOne({ _id: job.deviceId, userId: job.userId, version: job.deviceVersion }).select('+token').lean();
          if (!device) { await this.finish(job._id, false, 'device-revoked'); continue; }
          const result = job.receiptId ? await this.provider.receipt(job.receiptId) : await this.provider.send(device.token);
          if (result.error === 'DeviceNotRegistered') {
            await this.mutate(job._id, async session => this.devices.deleteOne({ _id: device._id, token: device.token }, { session }));
            await this.finish(job._id, true, 'DeviceNotRegistered');
          } else if (result.dryRun) {
            await this.finish(job._id, false, 'dry-run-not-sent');
          } else if (result.id) {
            await this.mutate(job._id, async session => this.deliveries.updateOne({ _id: job._id }, { $set: { status: 'receipt', receiptId: result.id, attempts: 0, runAt: new Date(Date.now() + 15 * 60000) } }, { session }));
          } else if (!result.error) {
            await this.finish(job._id, false, 'receipt-confirmed');
          } else if (result.error === 'ReceiptPending' || result.error === 'MessageRateExceeded') {
            if (job.attempts >= 6) await this.finish(job._id, true, 'retry-exhausted');
            else await this.defer(job._id, job.attempts);
          } else {
            await this.finish(job._id, true, 'provider-rejected');
          }
        } catch {
          if (!job.receiptId || job.attempts >= 6) await this.finish(job._id, true, 'outcome-unknown');
          else await this.defer(job._id, job.attempts);
        }
      }
    } catch { this.logger.warn('Push worker unavailable'); }
    finally { this.busy = false; }
  }

  private defer(id: Types.ObjectId, attempts: number) {
    return this.mutate(id, async session => this.deliveries.updateOne({ _id: id }, { $set: { runAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** attempts) + Math.random() * 5000) } }, { session }));
  }
}
