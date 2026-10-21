import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notifications } from '../notifications/schemas/notification.schema.js';
import { retention } from '../privacy/retention.js';
import { DryRunPushProvider, ExpoPushProvider, type PushProvider } from './push.provider.js';
import { PushDelivery, PushDevice } from './push.schema.js';

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
      await this.devices.findOneAndUpdate({ userId: owner, deviceId }, { $set: { token, version: current?.token === token ? current.version : new Types.ObjectId() } }, { upsert: true });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new BadRequestException('Push device already registered');
      throw error;
    }
    return { registered: true, mode: process.env.PUSH_PROVIDER === 'expo' ? 'expo' : 'dry-run' };
  }

  async revoke(userId: string, deviceId: string) {
    const device = await this.devices.findOneAndDelete({ userId: new Types.ObjectId(userId), deviceId });
    if (device) await this.deliveries.deleteMany({ userId: device.userId, deviceId: device._id });
    return { revoked: true };
  }

  async enqueue(userId: string, notificationId: string) {
    const owner = new Types.ObjectId(userId);
    if (!await this.notifications.exists({ userId: owner, 'items.id': notificationId })) throw new NotFoundException('Notification not found');
    const devices = await this.devices.find({ userId: owner }).select('_id version').lean();
    for (const device of devices) {
      await this.deliveries.updateOne({ notificationId, deviceId: device._id }, { $setOnInsert: {
        userId: owner, deviceId: device._id, deviceVersion: device.version, notificationId, status: 'pending', attempts: 0, runAt: new Date(),
      } }, { upsert: true });
    }
    return { queued: devices.length };
  }

  private finish(id: Types.ObjectId, failed: boolean, outcome: string) {
    const hours = failed ? retention('FAILED_JOB_TTL_DAYS') * 24 : retention('COMPLETED_JOB_TTL_HOURS');
    return this.deliveries.updateOne({ _id: id }, { $set: {
      status: failed ? 'failed' : 'completed', outcome, expiresAt: new Date(Date.now() + hours * 3600000),
    }, $unset: { receiptId: 1 } });
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      // CAS lease also allows another process to resume work after a crash.
      for (let count = 0; count < 20; count++) {
        const job = await this.deliveries.findOneAndUpdate({ status: { $in: ['pending', 'receipt'] }, runAt: { $lte: new Date() } },
          { $set: { runAt: new Date(Date.now() + 60000) }, $inc: { attempts: 1 } }, { returnDocument: 'after', sort: { runAt: 1 } }).lean();
        if (!job) break;
        try {
          const device = await this.devices.findOne({ _id: job.deviceId, userId: job.userId, version: job.deviceVersion }).select('+token').lean();
          if (!device) { await this.finish(job._id, false, 'device-revoked'); continue; }
          const result = job.receiptId ? await this.provider.receipt(job.receiptId) : await this.provider.send(device.token);
          if (result.error === 'DeviceNotRegistered') {
            await this.devices.deleteOne({ _id: device._id, token: device.token });
            await this.finish(job._id, true, 'DeviceNotRegistered');
          } else if (result.dryRun) {
            await this.finish(job._id, false, 'dry-run-not-sent');
          } else if (result.id) {
            await this.deliveries.updateOne({ _id: job._id }, { $set: { status: 'receipt', receiptId: result.id, attempts: 0, runAt: new Date(Date.now() + 15 * 60000) } });
          } else if (!result.error) {
            await this.finish(job._id, false, 'receipt-confirmed');
          } else if (result.error === 'ReceiptPending' || result.error === 'MessageRateExceeded') {
            if (job.attempts >= 6) await this.finish(job._id, true, 'retry-exhausted');
            else await this.defer(job._id, job.attempts);
          } else {
            await this.finish(job._id, true, 'provider-rejected');
          }
        } catch {
          if (job.attempts >= 6) await this.finish(job._id, true, 'retry-exhausted');
          else await this.defer(job._id, job.attempts);
        }
      }
    } catch { this.logger.warn('Push worker unavailable'); }
    finally { this.busy = false; }
  }

  private defer(id: Types.ObjectId, attempts: number) {
    return this.deliveries.updateOne({ _id: id }, { $set: { runAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** attempts) + Math.random() * 5000) } });
  }
}
