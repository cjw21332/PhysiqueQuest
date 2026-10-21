import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from '../src/health.controller.js';

describe('health/readiness', () => {
  it('keeps liveness independent of DB availability', () => expect(new HealthController({ readyState: 0 } as any).health()).toEqual({ status: 'ok' }));
  it('requires a connected, responding database for readiness', async () => {
    await expect(new HealthController({ readyState: 0 } as any).ready()).rejects.toThrow('Not ready');
    const command = vi.fn(async () => ({ ok: 1 }));
    await expect(new HealthController({ readyState: 1, db: { command } } as any).ready()).resolves.toEqual({ status: 'ready' });
    command.mockRejectedValue(new Error('private host'));
    await expect(new HealthController({ readyState: 1, db: { command } } as any).ready()).rejects.toThrow('Not ready');
  });
});
