import { emailStatus, enforceVerification } from '../src/auth/email-verification.js';
import { ConsoleMailProvider, HttpMailProvider, mailTemplate } from '../src/providers/mail.provider.js';
describe('email verification policy', () => {
  const enabled = { EMAIL_VERIFICATION_ENFORCED: 'true' };
  it('gates new users and preserves grandfathered access while requiring verification for sensitive changes', () => {
    expect(emailStatus({})).toEqual({ emailVerified: false, legacyEmailAccess: true });
    expect(emailStatus({ authPolicyVersion: 2 }).legacyEmailAccess).toBe(false);
    expect(() => enforceVerification({ legacyEmailAccess: false }, '/api/workouts', enabled)).toThrow('Verify your email');
    expect(() => enforceVerification({ legacyEmailAccess: true }, '/api/workouts', enabled)).not.toThrow();
    for (const path of ['/api/account/delete', '/api/auth/password-change/request']) expect(() => enforceVerification({ legacyEmailAccess: true }, path, enabled)).toThrow();
    for (const path of ['/api/profile', '/api/auth/me', '/api/v1/auth/logout', '/api/auth/verification/request']) expect(() => enforceVerification({}, path, enabled)).not.toThrow();
    expect(() => enforceVerification({ emailVerified: true }, '/api/workouts', enabled)).not.toThrow();
    expect(() => enforceVerification({}, '/api/workouts', {})).not.toThrow();
  });
  it('captures dev mail without logging and escapes templates', async () => {
    const provider = new ConsoleMailProvider();
    await provider.send({ template: 'verification', to: 'synthetic@example.invalid', token: 'synthetic', verificationUrl: 'https://example.invalid/verify#x="<script>' });
    expect(provider.messages).toHaveLength(1);
    expect(mailTemplate(provider.messages[0]).html).not.toContain('<script>');
  });
  it('uses fixed provider endpoints with deadlines and never follows redirects', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    try {
      await new HttpMailProvider({ MAIL_PROVIDER: 'resend', MAIL_API_KEY: 'synthetic', MAIL_FROM: 'sender@example.invalid' }).send({ template: 'password-reset', to: 'synthetic@example.invalid', token: '123456' });
      expect(fetcher).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
    } finally { fetcher.mockRestore(); }
  });
});
