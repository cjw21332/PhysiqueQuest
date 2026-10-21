import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { DryRunPushProvider, ExpoPushProvider } from './push.provider.js';
import { isExpoToken, PushService } from './push.service.js';
import { PushDeliverySchema } from './push.schema.js';

describe('push provider', () => {
  it('validates Expo tokens and never pretends dry-run sent a remote notification', async () => {
    expect(isExpoToken('ExpoPushToken[abcdefghijklmnop]')).toBe(true);
    expect(isExpoToken('https://attacker.example/token')).toBe(false);
    expect(await new DryRunPushProvider().send()).toEqual({ dryRun: true });
  });
  it('sends generic content without health data and reads receipt errors', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: 'ok', id: 'receipt-id' } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { 'receipt-id': { status: 'error', details: { error: 'DeviceNotRegistered' } } } })));
    const provider = new ExpoPushProvider(request);
    expect(await provider.send('ExpoPushToken[abcdefghijklmnop]')).toEqual({ id: 'receipt-id' });
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ to: 'ExpoPushToken[abcdefghijklmnop]', title: 'PhysiqueQuest', body: 'You have a new notification.', sound: 'default' });
    expect(await provider.receipt('receipt-id')).toEqual({ error: 'DeviceNotRegistered' });
  });
  it('handles provider transport failures without copying response PII into errors', async () => {
    const provider = new ExpoPushProvider(vi.fn().mockResolvedValue(new Response('sensitive user data', { status: 500 })));
    await expect(provider.send('token')).rejects.toThrow('Push provider unavailable');
  });
});

function fixture(job?: Record<string, unknown>) {
  const devices = { findOne: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue(null) }),
    findOneAndUpdate: vi.fn().mockResolvedValue({}), deleteOne: vi.fn().mockResolvedValue({}),
    find: vi.fn().mockReturnValue({ select: () => ({ lean: async () => [{ _id: new Types.ObjectId() }] }) }) };
  const deliveries = { findOneAndUpdate: vi.fn().mockReturnValueOnce({ lean: async () => job }).mockReturnValue({ lean: async () => null }),
    updateOne: vi.fn().mockResolvedValue({}) };
  const notifications = { exists: vi.fn().mockResolvedValue(true) };
  const service = new PushService(devices as any, deliveries as any, notifications as any);
  return { service, devices, deliveries, notifications };
}

describe('push queue ownership and retention', () => {
  it('rejects account takeover of an existing token', async () => {
    const f = fixture();
    f.devices.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ userId: new Types.ObjectId() }) });
    await expect(f.service.register(new Types.ObjectId().toHexString(), 'abcdefghijklmnop', 'ExpoPushToken[abcdefghijklmnop]')).rejects.toThrow('already registered');
    expect(f.devices.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('persists only references in queued payloads, never token, body, or health data', async () => {
    const f = fixture();
    const userId = new Types.ObjectId().toHexString();
    await f.service.enqueue(userId, 'notification-uuid');
    const payload = f.deliveries.updateOne.mock.calls[0][1].$setOnInsert;
    expect(Object.keys(payload).sort()).toEqual(['attempts', 'deviceId', 'deviceVersion', 'notificationId', 'runAt', 'status', 'userId']);
    expect(f.notifications.exists).toHaveBeenCalledWith({ userId: new Types.ObjectId(userId), 'items.id': 'notification-uuid' });
  });
  it('does not queue a notification owned by another account', async () => {
    const f = fixture(); f.notifications.exists.mockResolvedValue(false);
    await expect(f.service.enqueue(new Types.ObjectId().toHexString(), 'unknown')).rejects.toThrow('not found');
    expect(f.deliveries.updateOne).not.toHaveBeenCalled();
  });
  it('removes DeviceNotRegistered tokens and expires failures after seven days', async () => {
    const job = { _id: new Types.ObjectId(), deviceId: new Types.ObjectId(), userId: new Types.ObjectId(), receiptId: 'receipt', attempts: 1 };
    const f = fixture(job);
    f.devices.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: job.deviceId, token: 'ExpoPushToken[abcdefghijklmnop]' }) }) } as any);
    (f.service as any).provider = { receipt: async () => ({ error: 'DeviceNotRegistered' }) };
    await f.service.tick();
    expect(f.devices.deleteOne).toHaveBeenCalledWith({ _id: job.deviceId, token: 'ExpoPushToken[abcdefghijklmnop]' });
    const completion = f.deliveries.updateOne.mock.calls[0][1].$set;
    expect(completion.status).toBe('failed');
    expect(completion.expiresAt.getTime() - Date.now()).toBeGreaterThan(6.9 * 86400000);
  });
  it('marks dry runs explicitly and expires completed records after 24 hours', async () => {
    const job = { _id: new Types.ObjectId(), deviceId: new Types.ObjectId(), userId: new Types.ObjectId(), attempts: 1 };
    const f = fixture(job);
    f.devices.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ _id: job.deviceId, token: 'token' }) }) } as any);
    (f.service as any).provider = new DryRunPushProvider();
    await f.service.tick();
    const completion = f.deliveries.updateOne.mock.calls[0][1].$set;
    expect(completion.outcome).toBe('dry-run-not-sent');
    expect(completion.expiresAt.getTime() - Date.now()).toBeGreaterThan(23.9 * 3600000);
    expect(PushDeliverySchema.indexes()).toContainEqual([{ expiresAt: 1 }, { expireAfterSeconds: 0 }]);
  });
  it('does not send an old queued delivery to a rotated device token', async () => {
    const job = { _id: new Types.ObjectId(), deviceId: new Types.ObjectId(), deviceVersion: new Types.ObjectId(), userId: new Types.ObjectId(), attempts: 1, receiptId: 'old-receipt' };
    const f = fixture(job);
    f.devices.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) } as any);
    const receipt = vi.fn(); (f.service as any).provider = { receipt };
    await f.service.tick();
    expect(f.devices.findOne).toHaveBeenCalledWith({ _id: job.deviceId, userId: job.userId, version: job.deviceVersion });
    expect(receipt).not.toHaveBeenCalled();
    expect(f.devices.deleteOne).not.toHaveBeenCalled();
    expect(f.deliveries.updateOne.mock.calls[0][1].$set.outcome).toBe('device-revoked');
  });
});
