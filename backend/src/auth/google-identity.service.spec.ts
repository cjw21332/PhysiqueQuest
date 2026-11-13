import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginTicket } from 'google-auth-library';
import { readFileSync } from 'node:fs';
const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));
import { GoogleIdentityService } from './google-identity.service.js';
describe('Google identity verification', () => {
  const identityClaims = (overrides: Record<string, unknown> = {}) => ({
    iss: 'https://accounts.google.com',
    sub: 'google-user',
    email: 'USER@example.com',
    email_verified: true,
    name: 'User',
    ...overrides,
  });
  const ticket = (payload: unknown) => ({ getPayload: () => payload }) as unknown as LoginTicket;
  beforeEach(() => { vi.stubEnv('GOOGLE_WEB_CLIENT_ID', 'test-client-id'); verifyIdToken.mockReset(); });
  it('accepts a verified Google ID token for the configured OAuth client', async () => {
    verifyIdToken.mockResolvedValue(ticket(identityClaims()));
    expect(await new GoogleIdentityService().verify('token')).toEqual({ uid: 'google-user', email: 'user@example.com', name: 'User' });
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'token', audience: 'test-client-id' });
  });
  it('uses the Firebase Web OAuth client by default and matches the mobile build', async () => {
    vi.stubEnv('GOOGLE_WEB_CLIENT_ID', '');
    const firebase = JSON.parse(readFileSync(new URL('../../../mobile/google-services.json', import.meta.url), 'utf8'));
    const app = JSON.parse(readFileSync(new URL('../../../mobile/app.json', import.meta.url), 'utf8'));
    const android = firebase.client.find((client: any) => client.client_info.android_client_info.package_name === app.expo.android.package);
    const web = android.oauth_client.find((client: any) => client.client_type === 3).client_id;
    expect(app.expo.extra.googleWebClientId).toBe(web);
    verifyIdToken.mockResolvedValue(ticket(identityClaims()));
    await new GoogleIdentityService().verify('token');
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'token', audience: web });
  });
  it.each([
    { iss: 'accounts.example.com' },
    { email_verified: false },
    { sub: undefined },
    { email: undefined },
  ])('rejects invalid Google token claims', async overrides => {
    verifyIdToken.mockResolvedValue(ticket(identityClaims(overrides)));
    await expect(new GoogleIdentityService().verify('token')).rejects.toThrow('could not be verified');
  });
  it('rejects invalid and oversized tokens', async () => {
    verifyIdToken.mockRejectedValue(new Error('Invalid token'));
    await expect(new GoogleIdentityService().verify('token')).rejects.toThrow('could not be verified');
    await expect(new GoogleIdentityService().verify('x'.repeat(10001))).rejects.toThrow('Choose your Google account again');
  });
  it('surfaces provider transport outages without exposing provider errors', async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error('private provider error'), { code: 'ECONNRESET' }));
    await expect(new GoogleIdentityService().verify('token')).rejects.toThrow('temporarily unavailable');
  });
});
