import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAlertDto } from '../src/safety/dto/create-alert.dto.js';

const base = { idempotencyKey: 'safe-test-123456' };
const check = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateAlertDto, body), { whitelist: true, forbidNonWhitelisted: true });

describe('CreateAlertDto', () => {
  it('accepts an inactivity alert with location and workout id', () => {
    const errors = check({
      ...base,
      eventType: 'inactivity',
      location: { lat: 14.6, lng: 121.0, accuracyMeters: 12, capturedAt: '2026-10-12T10:00:00.000Z' },
      workoutSessionId: '507f1f77bcf86cd799439011',
      exerciseId: 'exercise-1',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a cancelled event without location', () => {
    expect(check({ ...base, eventType: 'cancelled' })).toHaveLength(0);
  });

  it('rejects latitude outside [-90, 90]', () => {
    const errors = check({ ...base, eventType: 'inactivity', location: { lat: 91, lng: 0, accuracyMeters: 5, capturedAt: '2026-10-12T10:00:00.000Z' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects longitude outside [-180, 180]', () => {
    const errors = check({ ...base, eventType: 'inactivity', location: { lat: 0, lng: -181, accuracyMeters: 5, capturedAt: '2026-10-12T10:00:00.000Z' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects accuracy outside [0, 10000]', () => {
    const errors = check({ ...base, eventType: 'inactivity', location: { lat: 0, lng: 0, accuracyMeters: 10001, capturedAt: '2026-10-12T10:00:00.000Z' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unknown event type', () => {
    expect(check({ ...base, eventType: 'panic' }).length).toBeGreaterThan(0);
  });

  it('rejects a malformed workout id', () => {
    expect(check({ ...base, eventType: 'inactivity', workoutSessionId: 'not-an-id' }).length).toBeGreaterThan(0);
  });
});
