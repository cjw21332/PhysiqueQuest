import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';

describe('notifications', () => {
  it('marks a notification without replacing concurrently added items', async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue({ items: [] });
    const service = new NotificationsService({ findOneAndUpdate } as never);
    await service.mark('507f1f77bcf86cd799439011', 'event-1', false);
    expect(findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ 'items.id': 'event-1' }), { $set: { 'items.$.unread': false } }, expect.anything());
  });
  it('queues a delivery only when the event is newly inserted', async () => {
    const updateOne = vi.fn().mockResolvedValueOnce({ modifiedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0 });
    const model = { findOneAndUpdate: vi.fn().mockResolvedValue({ items: [] }), updateOne };
    const enqueue = vi.fn().mockResolvedValue({ queued: 1 });
    const service = new NotificationsService(model as never, { enqueue } as never);
    const item = { icon: 'clipboard', title: 'Workout completed', subtitle: '', body: 'Saved', time: 'now', group: 'Today', unread: true };
    await service.addOnce('507f1f77bcf86cd799439011', 'workout:1', item);
    await service.addOnce('507f1f77bcf86cd799439011', 'workout:1', item);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(updateOne).toHaveBeenCalledWith(expect.objectContaining({ 'items.id': { $ne: 'workout:1' } }), expect.anything());
  });
  it('creates reminders at the selected local time and uses a date-based key', async () => {
    const records = [{ userId: '507f1f77bcf86cd799439011', reminder: { enabled: true, hour: 20, minute: 30, timezone: 'Asia/Singapore' } }];
    const model = { find: () => ({ select: () => ({ lean: () => ({ cursor: async function* () { yield* records; } }) }) }) };
    const service = new NotificationsService(model as never);
    const add = vi.spyOn(service, 'addOnce').mockResolvedValue();
    await service.sendReminders(new Date('2026-10-28T12:30:00Z'));
    expect(add).toHaveBeenCalledWith(records[0].userId, 'reminder:2026-10-28', expect.objectContaining({ title: 'Daily check-in' }));
    await service.sendReminders(new Date('2026-10-28T12:45:00Z'));
    expect(add).toHaveBeenCalledTimes(1);
  });
});
