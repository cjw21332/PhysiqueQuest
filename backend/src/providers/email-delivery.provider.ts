import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailDeliveryProvider {
  constructor(private readonly config: ConfigService) {}

  isAvailable() {
    return Boolean(
      this.config.get<string>('EMAILJS_SERVICE_ID')
      && this.config.get<string>('EMAILJS_TEMPLATE_ID')
      && this.config.get<string>('EMAILJS_PUBLIC_KEY')
    ) || Boolean(this.config.get<string>('EMAIL_DELIVERY_URL') && this.config.get<string>('EMAIL_DELIVERY_API_KEY'));
  }

  async sendPasswordReset(email: string, token: string) {
    const serviceId = this.config.get<string>('EMAILJS_SERVICE_ID');
    const templateId = this.config.get<string>('EMAILJS_TEMPLATE_ID');
    const publicKey = this.config.get<string>('EMAILJS_PUBLIC_KEY');
    if (serviceId && templateId && publicKey) {
      const privateKey = this.config.get<string>('EMAILJS_PRIVATE_KEY');
      try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            ...(privateKey ? { accessToken: privateKey } : {}),
            template_params: {
              to_email: email,
              otp: token,
              expires_in_minutes: 30,
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });
        return response.ok;
      } catch {
        return false;
      }
    }

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
