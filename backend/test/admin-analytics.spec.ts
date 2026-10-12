import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AdminAnalyticsService } from '../src/admin/admin-analytics.service.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { AdminAnalyticsController } from '../src/admin/admin-analytics.controller.js';
import { SignInEventSchema } from '../src/auth/schemas/sign-in-event.schema.js';
import { GUARDS_METADATA } from '@nestjs/common/constants';

const signInModel = (rows: unknown[]) =>
  ({ find: vi.fn(() => ({ select: () => ({ lean: () => ({ exec: async () => rows }) }) })) }) as any;

describe('admin analytics', () => {
  it('defines the occurredAt index once for sign-in event queries', () => {
    const occurredAtIndexes = SignInEventSchema.indexes().filter(([index]) =>
      Object.keys(index).length === 1 && index.occurredAt === 1,
    );
    expect(occurredAtIndexes).toHaveLength(1);
  });

  it('requires the admin role and limits ranges', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminAnalyticsController)).toContain(RolesGuard);
    const service = new AdminAnalyticsService({ countDocuments: vi.fn() } as any, { countDocuments: vi.fn() } as any, { countDocuments: vi.fn() } as any, signInModel([]));
    await expect(service.get(14)).rejects.toThrow();
  });

  it('returns database counts and marks unsupported analytics unavailable', async () => {
    const users = { countDocuments: vi.fn(async () => 12) };
    const workouts = { countDocuments: vi.fn(async () => 4) };
    const alerts = { countDocuments: vi.fn(async filter => filter.status === 'delivered' ? 2 : filter.status === 'failed' ? 1 : filter.status === 'pending' ? 3 : 6) };
    const result = await new AdminAnalyticsService(users as any, workouts as any, alerts as any, signInModel([])).get(30);
    expect(result.usersTotal).toBe(12);
    expect(result.completedSessions).toBe(4);
    expect(result.emergencyEvents).toEqual({ total: 6, delivered: 2, failed: 1, pending: 3 });
    expect(result.formScore).toBeNull();
  });

  it('derives active users and week-over-week retention from sign-in events', async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const rows = [
      { userId: 'a', occurredAt: new Date(now - 20 * day) },
      { userId: 'a', occurredAt: new Date(now - 6 * day) },
      { userId: 'a', occurredAt: new Date(now - 1 * day) },
      { userId: 'b', occurredAt: new Date(now - 6 * day) },
    ];
    const users = { countDocuments: vi.fn(async () => 3) };
    const workouts = { countDocuments: vi.fn(async () => 0) };
    const alerts = { countDocuments: vi.fn(async () => 0) };
    const result = await new AdminAnalyticsService(users as any, workouts as any, alerts as any, signInModel(rows)).get(30);
    expect(result.activeUsers).toBe(2);
    expect(result.weeklyRetention?.length).toBeGreaterThan(0);
    expect(result.weeklyRetention?.[result.weeklyRetention.length - 1]).toBe(50);
  });
});
