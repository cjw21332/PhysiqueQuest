import { outboundFetch } from '../common/outbound.js';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configuredMailProvider } from './mail.provider.js';

import { RECOVERY_CODE_VALIDITY_MINUTES as OTP_VALIDITY_MINUTES } from '../common/recovery-policy.js';

export type EmailDeliveryFailureCode =
  | 'EMAIL_NOT_CONFIGURED'
  | 'EMAIL_PROVIDER_REJECTED'
  | 'EMAIL_PROVIDER_AUTH'
  | 'EMAIL_PROVIDER_RATE_LIMITED'
  | 'EMAIL_PROVIDER_UNAVAILABLE'
  | 'EMAIL_PROVIDER_UNREACHABLE';

/** One in-app feedback entry, emailed to the team as soon as it is saved. */
export type FeedbackEmail = { rating: number; category: string; message: string; platform?: string; appVersion?: string; userName?: string; userEmail?: string; sentAt: Date };
export const DEFAULT_FEEDBACK_NOTIFY_EMAIL = 'waletcharlesjames3@gmail.com';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export type EmailDeliveryResult =
  | { ok: true }
  | { ok: false; code: EmailDeliveryFailureCode; status?: number; reason: string };

function classifyStatus(status: number): EmailDeliveryFailureCode {
  if (status === 401 || status === 403) return 'EMAIL_PROVIDER_AUTH';
  if (status === 429) return 'EMAIL_PROVIDER_RATE_LIMITED';
  if (status >= 500) return 'EMAIL_PROVIDER_UNAVAILABLE';
  return 'EMAIL_PROVIDER_REJECTED';
}

@Injectable()
export class EmailDeliveryProvider {
  private readonly logger = new Logger(EmailDeliveryProvider.name);

  constructor(private readonly config: ConfigService) {}

  private serviceId() {
    return this.config.get<string>('SERVICE_ID') ?? this.config.get<string>('EMAILJS_SERVICE_ID');
  }

  private templateId() {
    return this.config.get<string>('TEMPLATE_ID') ?? this.config.get<string>('EMAILJS_TEMPLATE_ID');
  }

  private publicKey() {
    return this.config.get<string>('PUBLIC_KEY') ?? this.config.get<string>('EMAILJS_PUBLIC_KEY');
  }

  /** Member-by-member view of which provider settings are present, for diagnostics. */
  diagnostics() {
    return {
      available: this.isAvailable(),
      serviceId: Boolean(this.serviceId()),
      templateId: Boolean(this.templateId()),
      publicKey: Boolean(this.publicKey()),
      privateKey: Boolean(this.config.get<string>('EMAILJS_PRIVATE_KEY')),
      legacyEndpoint: Boolean(this.config.get<string>('EMAIL_DELIVERY_URL')),
    };
  }

  isAvailable() {
    if (configuredMailProvider()) return true;
    return Boolean(this.serviceId() && this.templateId() && this.publicKey())
      || Boolean(this.config.get<string>('EMAIL_DELIVERY_URL') && this.config.get<string>('EMAIL_DELIVERY_API_KEY'));
  }

  async sendVerificationCode(email: string, code: string) {
    const provider = configuredMailProvider();
    if (provider) return provider.send({ template: 'verification-code', to: email, token: code });
    return (await this.sendPasswordReset(email, code)).ok;
  }

  /** Recipient for feedback alerts: FEEDBACK_NOTIFY_EMAIL, else the lead programmer's address. */
  feedbackRecipient() {
    return this.config.get<string>('FEEDBACK_NOTIFY_EMAIL')?.trim() || DEFAULT_FEEDBACK_NOTIFY_EMAIL;
  }

  /**
   * Emails one feedback entry to the team. Uses the configured mail provider (Resend, Brevo, Mailpit) when set,
   * otherwise EmailJS with FEEDBACK_TEMPLATE_ID (see docs/emails/feedback-template.html). Never throws.
   */
  async sendFeedback(feedback: FeedbackEmail): Promise<boolean> {
    const to = this.feedbackRecipient();
    const stars = `${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)}`;
    const from = feedback.userName || feedback.userEmail ? `${feedback.userName ?? 'A user'}${feedback.userEmail ? ` <${feedback.userEmail}>` : ''}` : 'A signed-in user';
    const device = [feedback.platform, feedback.appVersion && `v${feedback.appVersion}`].filter(Boolean).join(' ') || 'unknown device';
    const subject = `PhysiqueQuest feedback: ${feedback.category} · ${feedback.rating}/5`;
    const provider = configuredMailProvider();
    if (provider) {
      const text = `${subject}

From: ${from}
Device: ${device}
Rating: ${stars}
Sent: ${feedback.sentAt.toISOString()}

${feedback.message}`;
      const html = `<h2>New PhysiqueQuest feedback</h2><p><b>Type:</b> ${escapeHtml(feedback.category)}<br><b>Rating:</b> ${stars} (${feedback.rating}/5)<br><b>From:</b> ${escapeHtml(from)}<br><b>Device:</b> ${escapeHtml(device)}<br><b>Sent:</b> ${feedback.sentAt.toISOString()}</p><p style="white-space:pre-wrap">${escapeHtml(feedback.message)}</p>`;
      return provider.send({ template: 'feedback', to, subject, text, html }).catch(() => false);
    }
    const serviceId = this.serviceId(), publicKey = this.publicKey();
    const templateId = this.config.get<string>('FEEDBACK_TEMPLATE_ID');
    if (!serviceId || !publicKey || !templateId) {
      this.logger.warn('Feedback email skipped: set FEEDBACK_TEMPLATE_ID (EmailJS) or MAIL_PROVIDER.');
      return false;
    }
    const privateKey = this.config.get<string>('EMAILJS_PRIVATE_KEY');
    try {
      const response = await outboundFetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId, template_id: templateId, user_id: publicKey,
          ...(privateKey ? { accessToken: privateKey } : {}),
          template_params: { email: to, subject, category: feedback.category, rating: `${stars} (${feedback.rating}/5)`, message: feedback.message, from_user: from, device, sent_at: feedback.sentAt.toISOString() },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) { this.failure(response.status, await response.text().catch(() => '')); return false; }
      return true;
    } catch {
      this.logger.error('Feedback email request failed (EMAIL_PROVIDER_UNREACHABLE)');
      return false;
    }
  }

  async sendPasswordReset(email: string, token: string, name = 'there'): Promise<EmailDeliveryResult> {
    const provider = configuredMailProvider();
    if (provider) return await provider.send({ template: 'password-reset', to: email, token, name }) ? { ok: true } : { ok: false, code: 'EMAIL_PROVIDER_UNAVAILABLE', reason: 'Mail delivery failed.' };
    const serviceId = this.serviceId();
    const templateId = this.templateId();
    const publicKey = this.publicKey();
    if (serviceId && templateId && publicKey) {
      return this.sendWithEmailJs(email, token, serviceId, templateId, publicKey, name);
    }

    const endpoint = this.config.get<string>('EMAIL_DELIVERY_URL');
    const apiKey = this.config.get<string>('EMAIL_DELIVERY_API_KEY');
    if (endpoint && apiKey) {
      return this.sendWithLegacyEndpoint(email, token, endpoint, apiKey);
    }

    const reason = 'No email provider is configured.';
    this.logger.warn(reason);
    return { ok: false, code: 'EMAIL_NOT_CONFIGURED', reason };
  }

  private async sendWithEmailJs(
    email: string,
    token: string,
    serviceId: string,
    templateId: string,
    publicKey: string,
    name: string,
  ): Promise<EmailDeliveryResult> {
    const privateKey = this.config.get<string>('EMAILJS_PRIVATE_KEY');
    try {
      const response = await outboundFetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          ...(privateKey ? { accessToken: privateKey } : {}),
          template_params: {
            email,
            passcode: token,
            time: `${OTP_VALIDITY_MINUTES} minutes`,
            name: name.trim().split(/\s+/)[0] || 'there',
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return this.failure(response.status, await response.text().catch(() => ''));
      }
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error('EmailJS request failed (EMAIL_PROVIDER_UNREACHABLE)');
      return { ok: false, code: 'EMAIL_PROVIDER_UNREACHABLE', reason };
    }
  }

  private async sendWithLegacyEndpoint(
    email: string,
    token: string,
    endpoint: string,
    apiKey: string,
  ): Promise<EmailDeliveryResult> {
    try {
      const response = await outboundFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ template: 'password-reset', to: email, token, expiresInMinutes: OTP_VALIDITY_MINUTES }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return this.failure(response.status, await response.text().catch(() => ''));
      }
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error('Legacy email delivery request failed (EMAIL_PROVIDER_UNREACHABLE)');
      return { ok: false, code: 'EMAIL_PROVIDER_UNREACHABLE', reason };
    }
  }

  /** Turns a rejected provider response into a classified, logged failure. */
  private failure(status: number, body: string): EmailDeliveryResult {
    const code = classifyStatus(status);
    const reason = body.trim().slice(0, 500) || `Email provider responded with status ${status}.`;
    const detail = /template/i.test(body) ? 'template' : /service/i.test(body) ? 'service' : /quota|limit/i.test(body) ? 'quota' : /user|key|account/i.test(body) ? 'account' : 'other';
    this.logger.error(`Email delivery failed (${status}, ${code}, ${detail})`);
    return { ok: false, code, status, reason };
  }
}
