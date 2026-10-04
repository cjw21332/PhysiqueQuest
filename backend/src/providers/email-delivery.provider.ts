import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailDeliveryProvider {
  constructor(private readonly config: ConfigService) {}
  isAvailable() { return Boolean(this.config.get<string>('EMAIL_DELIVERY_URL') && this.config.get<string>('EMAIL_DELIVERY_API_KEY')); }
  async sendPasswordReset(email: string, token: string) {
    const endpoint = this.config.get<string>('EMAIL_DELIVERY_URL');
    const apiKey = this.config.get<string>('EMAIL_DELIVERY_API_KEY');
    if (!endpoint || !apiKey) return false;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ template: 'password-reset', to: email, token, expiresInMinutes: 30 }),
        signal: AbortSignal.timeout(10_000),
      });
      return response.ok;
    } catch { return false; }
  }
}
