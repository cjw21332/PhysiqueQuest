import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AuthThrottleGuard } from '../src/auth/auth-throttle.guard.js';

describe('shared auth throttling', () => {
  it('bounds login attempts across IP and account without storing email/IP', async () => {
    const model = { findOneAndUpdate: vi.fn(async () => ({ hits: 1 })) };
    const guard = new AuthThrottleGuard(model as any);
    const res = { setHeader: vi.fn() };
    const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ method: 'POST', url: '/api/auth/session/login', ip: '192.0.2.1', body: { email: 'private@example.com' } }), getResponse: () => res }) };
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(model.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(model.findOneAndUpdate.mock.calls)).not.toContain('private@example.com');
    model.findOneAndUpdate.mockResolvedValue({ hits: 121 });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many attempts');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });
  it('does not count ordinary reads', async () => {
    const model = { findOneAndUpdate: vi.fn() };
    const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ method: 'GET', url: '/api/profile' }) }) };
    expect(await new AuthThrottleGuard(model as any).canActivate(ctx)).toBe(true);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('uses the tighter shared bucket for job and upload creation', async () => {
    const model = { findOneAndUpdate: vi.fn(async () => ({ hits: 11 })) };
    for (const url of ['/api/jobs/nutrition', '/api/storage/uploads']) {
      const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ method: 'POST', url, ip: '192.0.2.1' }), getResponse: () => ({ setHeader: vi.fn() }) }) };
      await expect(new AuthThrottleGuard(model as any).canActivate(ctx)).rejects.toThrow('Too many attempts');
    }
  });
  it('throttles trailing-slash and case variants accepted by Express', async () => {
    const model = { findOneAndUpdate: vi.fn(async () => ({ hits: 1000 })) };
    const guard = new AuthThrottleGuard(model as any);
    for (const url of ['/api/auth/login/', '/api/AUTH/LOGIN', '/api/auth/session/refresh/?x=1', '/api/v1/auth/session/login']) {
      const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ method: 'POST', url, ip: '192.0.2.1' }), getResponse: () => ({ setHeader: vi.fn() }) }) };
      await expect(guard.canActivate(ctx)).rejects.toThrow('Too many attempts');
    }
  });
});
