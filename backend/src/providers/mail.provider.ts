import { outboundFetch } from '../common/outbound.js';
export type MailMessage = { template: 'verification' | 'verification-code' | 'password-reset'; to: string; name?: string; token: string; verificationUrl?: string };
export interface MailProvider { send(message: MailMessage): Promise<boolean>; }

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export function mailTemplate(message: MailMessage) {
  if (message.template === 'verification-code') return { subject: 'Your PhysiqueQuest verification code', text: `Your verification code is ${message.token}. It expires in 10 minutes.`, html: `<p>Your verification code is <strong>${escape(message.token)}</strong>.</p><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>` };
  const verification = message.template === 'verification';
  const subject = verification ? 'Verify your PhysiqueQuest email' : 'PhysiqueQuest password reset';
  const text = verification ? `Verify your email: ${message.verificationUrl}` : `Your password reset code is ${message.token}. It expires in 10 minutes.`;
  const html = verification ? `<p>Verify your PhysiqueQuest email:</p><p><a href="${escape(message.verificationUrl!)}">Verify email</a></p><p>If you did not request this, ignore this email.</p>` : `<p>Your password reset code is <strong>${escape(message.token)}</strong>.</p><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`;
  return { subject, text, html };
}

// Console transport deliberately captures only in memory; credentials/PII never enter logs.
export class ConsoleMailProvider implements MailProvider {
  readonly messages: MailMessage[] = [];
  async send(message: MailMessage) { this.messages.push(message); if (this.messages.length > 100) this.messages.shift(); return true; }
}

export class HttpMailProvider implements MailProvider {
  constructor(private readonly env = process.env) {}
  async send(message: MailMessage) {
    const content = mailTemplate(message);
    const provider = this.env.MAIL_PROVIDER;
    const from = this.env.MAIL_FROM || 'PhysiqueQuest <noreply@example.invalid>';
    let endpoint: string, headers: Record<string, string>, body: unknown;
    if (provider === 'resend') {
      endpoint = 'https://api.resend.com/emails';
      headers = { Authorization: `Bearer ${this.env.MAIL_API_KEY}` };
      body = { from, to: [message.to], ...content };
    } else if (provider === 'brevo') {
      endpoint = 'https://api.brevo.com/v3/smtp/email'; headers = { 'api-key': this.env.MAIL_API_KEY! };
      const address = /<([^>]+)>/.exec(from)?.[1] ?? from;
      body = { sender: { name: 'PhysiqueQuest', email: address }, to: [{ email: message.to }], subject: content.subject, htmlContent: content.html, textContent: content.text };
    } else {
      endpoint = `${this.env.MAILPIT_URL || 'http://127.0.0.1:8025'}/api/v1/send`; headers = {};
      const address = /<([^>]+)>/.exec(from)?.[1] ?? from;
      body = { From: { Email: address, Name: 'PhysiqueQuest' }, To: [{ Email: message.to }], Subject: content.subject, Text: content.text, HTML: content.html };
    }
    try {
      const result = await outboundFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000), redirect: 'error' });
      await result.arrayBuffer();
      return result.ok;
    } catch { return false; }
  }
}

export const consoleMailbox = new ConsoleMailProvider();
export function configuredMailProvider(env = process.env): MailProvider | undefined {
  if (env.MAIL_PROVIDER === 'console' && env.NODE_ENV !== 'production') return consoleMailbox;
  if (['mailpit', 'resend', 'brevo'].includes(env.MAIL_PROVIDER ?? '')) return new HttpMailProvider(env);
  return undefined;
}
