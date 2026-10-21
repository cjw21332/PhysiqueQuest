import { describe, expect, it, vi } from 'vitest';
import { SafetyService } from '../src/safety/safety.service.js';
import type { AlertDeliveryProvider } from '../src/providers/alert-delivery.provider.js';

describe('safety alert delivery', () => {
  it('does not claim delivery when provider is missing', async () => {
    const create = vi.fn(async value => value);
    const provider = { isAvailable: () => false, send: vi.fn() } as unknown as AlertDeliveryProvider;
    const service = new SafetyService({ create, findOne: vi.fn().mockReturnValue({ exec: async () => null }) } as any, { findByUserId: async () => ({ contactName: 'Friend', contactPhone: '+15555550123' }) } as any, { add: vi.fn() } as any, provider, {} as any);
    const result = await service.send('507f1f77bcf86cd799439011', { idempotencyKey: 'safe-test-123456', eventType: 'manual' });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('PROVIDER_NOT_CONFIGURED');
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('notifies only after confirmed provider delivery and deduplicates keys', async () => {
    const events: any[] = [];
    const create = vi.fn(async value => { const record = { _id: String(events.length + 1), ...value, save: vi.fn(async function (this: any) { return this; }) }; events.push(record); return record; });
    const findOne = vi.fn().mockReturnValue({ exec: async () => events[0] ?? null });
    const add = vi.fn();
    const provider = { isAvailable: () => true, send: vi.fn(async () => ({ confirmed: true, providerReference: 'accepted-1' })) } as unknown as AlertDeliveryProvider;
    const service = new SafetyService({ create, findOne } as any, { findByUserId: async () => ({ contactName: 'Friend', contactPhone: '+15555550123' }) } as any, { add } as any, provider, {} as any);
    const body = { idempotencyKey: 'safe-test-123456', eventType: 'manual' as const };
    expect((await service.send('507f1f77bcf86cd799439011', body)).status).toBe('delivered');
    expect(add).toHaveBeenCalledOnce();
    expect((await service.send('507f1f77bcf86cd799439011', body)).status).toBe('delivered');
    expect(create).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledOnce();
  });
});
