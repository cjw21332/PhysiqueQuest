import { Injectable } from '@nestjs/common';
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
    const profile = await this.profiles.findByUserId(userId);
    const available = this.provider.isAvailable();
    const contactConfigured = Boolean(profile.contactName?.trim() && profile.contactPhone?.trim());
    const occurredAt = new Date();
    let event: HydratedDocument<AlertEvent>;
    try {
      event = await this.model.create({ userId: owner, idempotencyKey: dto.idempotencyKey, eventType: dto.eventType, status: available && contactConfigured ? 'pending' : 'failed', ...(!available ? { errorCode: 'PROVIDER_NOT_CONFIGURED' } : !contactConfigured ? { errorCode: 'CONTACT_NOT_CONFIGURED' } : {}), occurredAt });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        return this.model.findOne({ userId: owner, idempotencyKey: dto.idempotencyKey }).exec();
      }
      throw error;
    }
    if (!available || !contactConfigured) return event;
    const result = await this.provider.send({ to: profile.contactPhone, contactName: profile.contactName, eventType: dto.eventType, occurredAt: occurredAt.toISOString(), idempotencyKey: `${userId}:${dto.idempotencyKey}` });
    event.status = result.confirmed ? 'delivered' : 'failed';
    if (result.confirmed && result.providerReference) event.providerReference = result.providerReference;
    if (!result.confirmed) event.errorCode = 'DELIVERY_NOT_CONFIRMED';
    const saved = await event.save();
    if (result.confirmed) await this.notifications.add(userId, { icon: 'shield', title: 'Safety alert delivered', subtitle: '', body: 'The configured provider confirmed delivery to your emergency contact.', time: 'now', group: 'Today', unread: true });
    return saved;
  }
}
