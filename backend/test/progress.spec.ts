import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { ProgressService } from '../src/progress/progress.service.js';
import type { ProgressEntry } from '../src/progress/schemas/progress-entry.schema.js';

describe('user-owned progress measurements', () => {
  it('validates metric-compatible units and positive bounded values', async () => {
    const service = new ProgressService({ create: vi.fn() } as unknown as Model<ProgressEntry>);
    await expect(service.add('507f1f77bcf86cd799439011', { metric: 'weight', value: 0, unit: 'kg', measuredAt: '2026-10-04T10:00:00Z' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.add('507f1f77bcf86cd799439011', { metric: 'waist', value: 70, unit: 'kg', measuredAt: '2026-10-04T10:00:00Z' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns ascending caller-owned history and scopes deletion', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const rows = [{ measuredAt: new Date('2026-10-01') }, { measuredAt: new Date('2026-10-03') }];
    const find = vi.fn().mockReturnValue({ sort: () => ({ limit: async () => rows }) });
    const findOneAndDelete = vi.fn().mockResolvedValue(null);
    const service = new ProgressService({ find, findOneAndDelete } as unknown as Model<ProgressEntry>);
    expect(await service.list(userId, 'weight')).toEqual(rows);
    expect(find.mock.calls[0]?.[0].userId).toEqual(new Types.ObjectId(userId));
    await expect(service.remove(userId, '507f1f77bcf86cd799439012')).rejects.toBeInstanceOf(NotFoundException);
    expect(findOneAndDelete.mock.calls[0]?.[0].userId).toEqual(new Types.ObjectId(userId));
  });

  it('creates records with owner derived from authentication and supports empty history', async () => {
    const create = vi.fn().mockImplementation(async row => row);
    const find = vi.fn().mockReturnValue({ sort: () => ({ limit: async () => [] }) });
    const service = new ProgressService({ create, find } as unknown as Model<ProgressEntry>);
    const entry = await service.add('507f1f77bcf86cd799439011', { metric: 'benchPress', value: 62.5, unit: 'kg', measuredAt: '2026-10-04T10:00:00Z' });
    expect(entry.userId).toEqual(new Types.ObjectId('507f1f77bcf86cd799439011'));
    expect(await service.list('507f1f77bcf86cd799439011', 'waist')).toEqual([]);
  });
});
