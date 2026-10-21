import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SafetyService } from '../src/safety/safety.service.js';

const USER = '507f1f77bcf86cd799439011';
const OTHER_USER = '507f1f77bcf86cd799439099';
const WORKOUT = '507f1f77bcf86cd799439012';
const location = { lat: 14.6, lng: 121.0, accuracyMeters: 12, capturedAt: '2026-10-12T10:00:00.000Z' };

const withContact = { findByUserId: async () => ({ contactName: 'Friend', contactPhone: '+15555550123' }) };
const withoutContact = { findByUserId: async () => ({ contactName: '', contactPhone: '' }) };

function makeModel(store: any[] = []) {
  const create = vi.fn(async (value: any) => {
    const record = { _id: String(store.length + 1).padStart(24, '0'), ...value, save: vi.fn(async function (this: any) { return this; }) };
    store.push(record);
    return record;
  });
  const findOne = vi.fn((filter: any) => ({
    exec: async () =>
      store.find(r =>
        String(r.userId) === String(filter.userId) &&
        (filter.idempotencyKey !== undefined ? r.idempotencyKey === filter.idempotencyKey : String(r._id) === String(filter._id))
      ) ?? null,
  }));
  return { create, findOne };
}

function makeProvider(confirmed = true, available = true) {
  return {
    isAvailable: () => available,
    send: vi.fn(async () => ({ confirmed, providerReference: confirmed ? 'accepted-1' : undefined })),
  };
}

describe('cancelled events', () => {
  it('stores a cancelled record without calling the provider or notifications', async () => {
    const model = makeModel();
    const provider = makeProvider();
    const add = vi.fn();
    const service = new SafetyService(model as any, withContact as any, { add } as any, provider as any, {} as any);
    const result = await service.send(USER, { idempotencyKey: 'cancel-test-123456', eventType: 'cancelled' });
    expect(result.status).toBe('cancelled');
    expect(provider.send).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
});

describe('inactivity alert payload', () => {
  it('forwards location, workout id, and exercise id to the provider', async () => {
    const model = makeModel();
    const provider = makeProvider(true);
    const detail = vi.fn(async () => ({}));
    const service = new SafetyService(model as any, withContact as any, { add: vi.fn() } as any, provider as any, { detail } as any);
    const result = await service.send(USER, {
      idempotencyKey: 'inactive-test-123456',
      eventType: 'inactivity',
      location,
      workoutSessionId: WORKOUT,
      exerciseId: 'exercise-2',
    });
    expect(result.status).toBe('delivered');
    const payload = provider.send.mock.calls[0][0] as any;
    expect(payload.to).toBe('+15555550123');
    expect(payload.location).toEqual(location);
    expect(payload.workoutSessionId).toBe(WORKOUT);
    expect(payload.exerciseId).toBe('exercise-2');
    expect(detail).toHaveBeenCalledWith(USER, WORKOUT);
  });
  it('rejects another account\'s workout association before storing or delivering an alert', async () => {
    const model = makeModel(), provider = makeProvider(true);
    const service = new SafetyService(model as any, withContact as any, { add: vi.fn() } as any, provider as any, { detail: vi.fn(async () => { throw new Error('Workout not found'); }) } as any);
    await expect(service.send(USER, { idempotencyKey: 'ownership-check', eventType: 'inactivity', workoutSessionId: WORKOUT })).rejects.toThrow('Workout not found');
    expect(provider.send).not.toHaveBeenCalled();
  });

  // Review Focus 2: location denied or timed out. The alert still goes out, without location.
  it('sends without location when the lifter gave none', async () => {
    const model = makeModel();
    const provider = makeProvider(true);
    const service = new SafetyService(model as any, withContact as any, { add: vi.fn() } as any, provider as any, {} as any);
    await service.send(USER, { idempotencyKey: 'noloc-test-1234567', eventType: 'inactivity' });
    const payload = provider.send.mock.calls[0][0] as any;
    expect(payload.location).toBeUndefined();
    expect(provider.send).toHaveBeenCalledOnce();
  });

  // Review Focus 5: no emergency contact saved. Recorded as failed; the alarm still sounds on the device.
  it('records CONTACT_NOT_CONFIGURED and does not call the provider when no contact is saved', async () => {
    const model = makeModel();
    const provider = makeProvider(true);
    const service = new SafetyService(model as any, withoutContact as any, { add: vi.fn() } as any, provider as any, {} as any);
    const result = await service.send(USER, { idempotencyKey: 'nocontact-test-1234', eventType: 'inactivity' });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('CONTACT_NOT_CONFIGURED');
    expect(provider.send).not.toHaveBeenCalled();
  });

  // Review Focus 3: a retried request with the same key returns the stored record and does not resend.
  it('returns the stored record for a repeated idempotency key without a second provider call', async () => {
    const model = makeModel();
    const provider = makeProvider(true);
    const service = new SafetyService(model as any, withContact as any, { add: vi.fn() } as any, provider as any, {} as any);
    const body = { idempotencyKey: 'retry-test-1234567', eventType: 'inactivity' as const };
    await service.send(USER, body);
    const second = await service.send(USER, body);
    expect(second.status).toBe('delivered');
    expect(model.create).toHaveBeenCalledOnce();
    expect(provider.send).toHaveBeenCalledOnce();
  });
});

describe('resolve', () => {
  it('sets resolvedAt and flagged on the owner\'s inactivity alert and is idempotent', async () => {
    const model = makeModel();
    const service = new SafetyService(model as any, withContact as any, { add: vi.fn() } as any, makeProvider(true) as any, {} as any);
    const created = await service.send(USER, { idempotencyKey: 'resolve-test-123456', eventType: 'inactivity' });
    const first = await service.resolve(USER, String(created._id));
    expect(first.flagged).toBe(true);
    expect(first.resolvedAt).toBeInstanceOf(Date);
    const stamp = first.resolvedAt;
    const second = await service.resolve(USER, String(created._id));
    expect(second.resolvedAt).toBe(stamp);
  });

  it('returns not found to a different user', async () => {
    const model = makeModel();
    const service = new SafetyService(model as any, withContact as any, { add: vi.fn() } as any, makeProvider(true) as any, {} as any);
    const created = await service.send(USER, { idempotencyKey: 'owner-test-1234567', eventType: 'inactivity' });
    await expect(service.resolve(OTHER_USER, String(created._id))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects resolving a manual alert', async () => {
    const model = makeModel();
    const service = new SafetyService(model as any, withContact as any, { add: vi.fn() } as any, makeProvider(true) as any, {} as any);
    const created = await service.send(USER, { idempotencyKey: 'manual-test-1234567', eventType: 'manual' });
    await expect(service.resolve(USER, String(created._id))).rejects.toBeInstanceOf(BadRequestException);
  });
});
