export const retentionDefaults = {
  ACCOUNT_DELETION_GRACE_DAYS: 30,
  MEDIA_ORIGINAL_TTL_HOURS: 24,
  ORPHAN_UPLOAD_TTL_HOURS: 24,
  COMPLETED_JOB_TTL_HOURS: 24,
  FAILED_JOB_TTL_DAYS: 7,
  AUDIT_LOG_HOT_DAYS: 90,
  AUDIT_LOG_RETENTION_MONTHS: 12,
  REFRESH_TOKEN_RECORD_BUFFER_DAYS: 30,
} as const;

export function retention(name: keyof typeof retentionDefaults, env = process.env): number {
  const value = env[name];
  if (value === undefined || value === '') return retentionDefaults[name];
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 3650) throw new Error(`Invalid ${name}`);
  return Number(value);
}

export const afterDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400_000);

export function auditExpiry(date: Date) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + retention('AUDIT_LOG_RETENTION_MONTHS'));
  return result;
}

// The queue deliberately accepts references only, including on internal calls.
export function assertJobPayload(payload: Record<string, unknown>) {
  if (Object.keys(payload).some(key => !['userId', 'resourceId'].includes(key)) ||
      Object.values(payload).some(value => typeof value !== 'string' || !/^[a-f0-9]{24}$/.test(value))) {
    throw new Error('Job payload must contain IDs only');
  }
}
