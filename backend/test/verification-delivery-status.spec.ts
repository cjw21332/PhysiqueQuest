import { afterEach, expect, it, vi } from 'vitest';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';

afterEach(() => vi.unstubAllEnvs());
it('reports missing dev delivery equally for existing and unknown accounts', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('MAIL_PROVIDER', '');
  const findOne = vi.fn().mockResolvedValue(null);
  const service = new EmailVerificationService({ db: { collection: () => ({ updateOne: async () => ({}), findOne }) } } as any, {} as any);
  const unknown = await service.request('synthetic@example.invalid');
  findOne.mockResolvedValue({ emailVerified: false });
  expect(await service.request('other@example.invalid')).toEqual(unknown);
  expect(unknown).toEqual({ accepted: true, developmentDelivery: 'unavailable' });
  vi.stubEnv('NODE_ENV', 'production');
  expect(await service.request('other@example.invalid')).toEqual({ accepted: true });
});
