import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AdminAnalyticsService } from '../src/admin/admin-analytics.service.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { AdminAnalyticsController } from '../src/admin/admin-analytics.controller.js';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('admin analytics', () => {
  it('requires the admin role and limits ranges', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminAnalyticsController)).toContain(RolesGuard);
    const service = new AdminAnalyticsService({ countDocuments: vi.fn() } as any, { countDocuments: vi.fn() } as any, { countDocuments: vi.fn() } as any);
    await expect(service.get(14)).rejects.toThrow();
  });

  it('returns database counts and marks unsupported analytics unavailable', async () => {
    const users = { countDocuments: vi.fn(async () => 12) };
    const workouts = { countDocuments: vi.fn(async () => 4) };
    const alerts = { countDocuments: vi.fn(async filter => filter.status === 'delivered' ? 2 : filter.status === 'failed' ? 1 : filter.status === 'pending' ? 3 : 6) };
    const result = await new AdminAnalyticsService(users as any, workouts as any, alerts as any).get(30);
    expect(result.usersTotal).toBe(12);
    expect(result.completedSessions).toBe(4);
    expect(result.emergencyEvents).toEqual({ total: 6, delivered: 2, failed: 1, pending: 3 });
    expect(result.formScore).toBeNull();
    expect(result.weeklyRetention).toBeNull();
  });
});
