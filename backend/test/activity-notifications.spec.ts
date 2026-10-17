import { describe, expect, it } from 'vitest';
import { ActivityService } from '../src/activity/activity.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

describe('activity and notification services', () => {
  it('starts activity with no fabricated progress', async () => {
    const state: any = { state: { timezone: 'UTC' } };
    const model = { findOne: () => ({ exec: async () => state }) } as any;
    const result = await new ActivityService(model, { read: async () => ({ meals: [], water: [] }) } as any, { creditHistory: async () => [] } as any).get('507f1f77bcf86cd799439011');
    expect(result.state.questProgress).toEqual({ workout: 0, meals: 0, water: 0 });
    expect(result.dailyMissions.every(mission => !mission.complete)).toBe(true);
  });

  it('marks a stored notification read', async () => {
    const state: any = { items: [{ id: 'n1', unread: true }], save: async function () { return this; } };
    const model = { findOneAndUpdate: async () => state } as any;
    const result = await new NotificationsService(model).mark('507f1f77bcf86cd799439011', 'n1', false);
    expect(result.items[0].unread).toBe(false);
  });
});

