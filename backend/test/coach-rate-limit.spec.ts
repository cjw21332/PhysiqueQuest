import { expect, it, vi } from 'vitest';
import { CoachRateLimitGuard } from '../src/coach/coach-rate-limit.guard.js';
it('bounds expensive public Coach requests per IP and recovers after the window', () => {
  let now = 1000; const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
  const guard = new CoachRateLimitGuard(); const setHeader = vi.fn();
  const context: any = { switchToHttp: () => ({ getRequest: () => ({ ip: '192.0.2.1', method: 'POST' }), getResponse: () => ({ setHeader }) }) };
  try {
    for (let i = 0; i < 10; i++) expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow('Too many Coach');
    now += 61_000; expect(guard.canActivate(context)).toBe(true);
  } finally { clock.mockRestore(); }
});
