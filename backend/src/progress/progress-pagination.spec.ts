import { describe, expect, it, vi } from 'vitest';
import { ProgressService } from './progress.service.js';

describe('measurement pagination', () => {
  it('accepts chest and arm circumferences and rejects weight units for them', async () => {
    const create = vi.fn().mockResolvedValue({});
    const service = new ProgressService({ create } as never);
    const user = '507f1f77bcf86cd799439011';
    for (const metric of ['chest', 'arms'] as const) {
      await service.add(user, { metric, value: 30, unit: 'cm', measuredAt: '2026-01-01T00:00:00.000Z' });
      await expect(service.add(user, { metric, value: 30, unit: 'kg', measuredAt: '2026-01-01T00:00:00.000Z' })).rejects.toThrow('Unit is not valid');
    }
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('uses a stable order and applies the requested offset and capped page size', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    const find = vi.fn().mockReturnValue({ sort });
    const service = new ProgressService({ find } as never);
    await service.list('507f1f77bcf86cd799439011', 'weight', 500, 365);
    expect(sort).toHaveBeenCalledWith({ measuredAt: -1, _id: -1 });
    expect(skip).toHaveBeenCalledWith(365);
    expect(limit).toHaveBeenCalledWith(365);
    await expect(service.list('507f1f77bcf86cd799439011', 'weight', 90, -1)).rejects.toThrow();
  });
});
