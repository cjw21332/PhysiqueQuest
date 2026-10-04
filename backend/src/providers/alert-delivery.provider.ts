import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AlertDeliveryProvider {
  constructor(private readonly config: ConfigService) {}
  isAvailable() { return Boolean(this.config.get<string>('ALERT_DELIVERY_URL') && this.config.get<string>('ALERT_DELIVERY_API_KEY')); }
  async send(payload: { to: string; contactName: string; eventType: string; occurredAt: string; idempotencyKey: string }) {
    const endpoint = this.config.get<string>('ALERT_DELIVERY_URL');
    const apiKey = this.config.get<string>('ALERT_DELIVERY_API_KEY');
    if (!endpoint || !apiKey) return { confirmed: false };
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': payload.idempotencyKey }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return { confirmed: false };
      const result = await response.json().catch(() => ({})) as { id?: string };
      return { confirmed: true, providerReference: result.id };
    } catch { return { confirmed: false }; }
  }
}
