import { afterDays, assertJobPayload, auditExpiry, retention } from '../src/privacy/retention.js';

describe('retention boundaries', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('uses configurable defaults and rejects unsafe TTLs', () => {
    expect(retention('ACCOUNT_DELETION_GRACE_DAYS', {})).toBe(30);
    expect(retention('FAILED_JOB_TTL_DAYS', { FAILED_JOB_TTL_DAYS: '14' })).toBe(14);
    for (const value of ['0', '-1', 'NaN', '1.5', '3651']) expect(() => retention('COMPLETED_JOB_TTL_HOURS', { COMPLETED_JOB_TTL_HOURS: value })).toThrow();
    expect(afterDays(new Date('2026-01-01Z'), 30).toISOString()).toBe('2026-01-31T00:00:00.000Z');
    vi.stubEnv('AUDIT_LOG_RETENTION_MONTHS', '12');
    expect(auditExpiry(new Date('2026-01-01Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
  it('rejects media, PII, operators and arbitrary fields in queue payloads', () => {
    expect(() => assertJobPayload({ userId: 'a'.repeat(24) })).not.toThrow();
    for (const payload of [{ image: 'base64' }, { email: 'synthetic@example.invalid' }, { userId: { $ne: null } }, { resourceId: 'image.jpg' }]) expect(() => assertJobPayload(payload)).toThrow('IDs only');
  });
});
