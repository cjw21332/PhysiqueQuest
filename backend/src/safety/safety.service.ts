import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type HydratedDocument } from 'mongoose';
import { ProfileService } from '../profile/profile.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AlertDeliveryProvider } from '../providers/alert-delivery.provider.js';
import { CreateAlertDto } from './dto/create-alert.dto.js';
import { AlertEvent } from './schemas/alert-event.schema.js';

@Injectable()
export class SafetyService {
  constructor(
    @InjectModel(AlertEvent.name) private readonly model: Model<AlertEvent>,
    private readonly profiles: ProfileService,
    private readonly notifications: NotificationsService,
    private readonly provider: AlertDeliveryProvider,
  ) {}

  async send(userId: string, dto: CreateAlertDto) {
    const owner = new Types.ObjectId(userId);
    const existing = await this.model.findOne({ userId: owner, idempotencyKey: dto.idempotencyKey }).exec();
    if (existing) return existing;
    const occurredAt = new Date();
    const details = {
      ...(dto.location ? { location: { lat: dto.location.lat, lng: dto.location.lng, accuracyMeters: dto.location.accuracyMeters, capturedAt: new Date(dto.location.capturedAt) } } : {}),
      ...(dto.workoutSessionId ? { workoutSessionId: new Types.ObjectId(dto.workoutSessionId) } : {}),
      ...(dto.exerciseId ? { exerciseId: dto.exerciseId } : {}),
    };

    // A cancelled countdown is a record only. It never reaches the provider or the contact.
    if (dto.eventType === 'cancelled') {
      return (await this.insertOrExisting(owner, dto, { status: 'cancelled', occurredAt, ...details })).record;
    }

    const profile = await this.profiles.findByUserId(userId);
    const available = this.provider.isAvailable();
    const contactConfigured = Boolean(profile.contactName?.trim() && profile.contactPhone?.trim());
    let event: HydratedDocument<AlertEvent>;
    const inserted = await this.insertOrExisting(owner, dto, {
      status: available && contactConfigured ? 'pending' : 'failed',
      ...(!available ? { errorCode: 'PROVIDER_NOT_CONFIGURED' } : !contactConfigured ? { errorCode: 'CONTACT_NOT_CONFIGURED' } : {}),
      occurredAt,
      ...details,
    });
    // A duplicate key returns the stored record; it was already sent, so do not send again.
    if (inserted.createdNow === false) return inserted.record;
    event = inserted.record;
    if (!available || !contactConfigured) return event;

    const result = await this.provider.send({
      to: profile.contactPhone,
      contactName: profile.contactName,
      eventType: dto.eventType,
      occurredAt: occurredAt.toISOString(),
      idempotencyKey: `${userId}:${dto.idempotencyKey}`,
      ...(dto.location ? { location: dto.location } : {}),
      ...(dto.workoutSessionId ? { workoutSessionId: dto.workoutSessionId } : {}),
      ...(dto.exerciseId ? { exerciseId: dto.exerciseId } : {}),
    });
    event.status = result.confirmed ? 'delivered' : 'failed';
    if (result.confirmed && result.providerReference) event.providerReference = result.providerReference;
    if (!result.confirmed) event.errorCode = 'DELIVERY_NOT_CONFIRMED';
    const saved = await event.save();
    if (result.confirmed) await this.notifications.add(userId, { icon: 'shield', title: 'Safety alert delivered', subtitle: '', body: 'The configured provider confirmed delivery to your emergency contact.', time: 'now', group: 'Today', unread: true });
    return saved;
  }

  /** Marks an inactivity alert as resolved after the lifter's 3-second hold. Only the owner can resolve it. */
  async resolve(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Alert not found');
    const event = await this.model.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).exec();
    if (!event) throw new NotFoundException('Alert not found');
    if (event.eventType !== 'inactivity') throw new BadRequestException('Only inactivity alerts can be resolved');
    if (event.resolvedAt) return event;
    event.resolvedAt = new Date();
    event.flagged = true;
    return event.save();
  }

  private async insertOrExisting(owner: Types.ObjectId, dto: CreateAlertDto, fields: Record<string, unknown>) {
    try {
      const record = await this.model.create({ userId: owner, idempotencyKey: dto.idempotencyKey, eventType: dto.eventType, ...fields });
      return { record, createdNow: true as const };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        const record = await this.model.findOne({ userId: owner, idempotencyKey: dto.idempotencyKey }).exec();
        return { record, createdNow: false as const };
      }
      throw error;
    }
  }
}
