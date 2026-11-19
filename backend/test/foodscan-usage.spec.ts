import { describe, expect, it, vi } from 'vitest';
import { FoodScanUsageService } from '../src/foodscan/foodscan-usage.service.js';
import { FoodScanController } from '../src/foodscan/foodscan.controller.js';
import { ErrorCode } from '../src/common/foodscan/errors.js';

const user = '64b7f1c2a1b2c3d4e5f60718';
function connectionFor(records: any, lifecycle: any = { findOne: async () => ({ generation: 0 }), updateOne: async () => ({ matchedCount: 1 }) }) {
  const collection = (name: string) => name === 'account_lifecycle' ? lifecycle : records;
  return { db: { collection }, collection, startSession: async () => ({ inTransaction: () => true, withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} }) };
}
describe('food scan usage ledger', () => {
  it('creates one idempotent user-scoped record and never assumes token counts', async () => {
    const insertOne = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce({ code: 11000 });
    const updateOne = vi.fn().mockResolvedValue({});
    const collection = { insertOne, updateOne, findOne: async () => ({ userId: user, generation: 0 }), createIndex: vi.fn().mockResolvedValue('user_index') };
    const service = new FoodScanUsageService(connectionFor(collection) as never);
    const id = await service.begin(user, 'request-1', 'gemini-test');
    expect(insertOne.mock.calls[0][0]).toMatchObject({ requestId: 'request-1', model: 'gemini-test', status: 'pending', input: null, output: null, total: null, estimatedCost: null });
    expect(String(insertOne.mock.calls[0][0].userId)).toBe(user);
    await expect(service.begin(user, 'request-1', 'gemini-test')).rejects.toMatchObject({ code: ErrorCode.INVALID_REQUEST });
    await service.finish(id, 'success', { input: 12, output: null, total: 18 });
    expect(updateOne.mock.calls[0][1].$set).toMatchObject({ status: 'success', usageAvailable: true, input: 12, output: null, total: 18 });
  });
  it('fails closed on database failure before analysis', async () => {
    const service = new FoodScanUsageService({ db: { collection: (name: string) => name === 'users' ? { findOne: async () => ({}) } : { createIndex: vi.fn().mockResolvedValue('user_index'), insertOne: vi.fn().mockRejectedValue(new Error('offline')) } } } as never);
    await expect(service.begin(user, 'request-2', 'test')).rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
  });
  it('rejects a reservation if the lifecycle transition wins before persistence', async () => {
    const records = { createIndex: vi.fn().mockResolvedValue('index'), insertOne: vi.fn().mockResolvedValue({}) };
    const lifecycle = { findOne: async () => ({ generation: 0 }), updateOne: async () => ({ matchedCount: 0 }) };
    const service = new FoodScanUsageService(connectionFor(records, lifecycle) as never);
    await expect(service.begin(user, 'deleted-race', 'test')).rejects.toMatchObject({ code: ErrorCode.SERVICE_UNAVAILABLE });
    expect(records.insertOne).not.toHaveBeenCalled();
  });
  it('retries a failed completion write without another provider request', async () => {
    const updateOne = vi.fn().mockRejectedValueOnce(new Error('temporary database failure')).mockResolvedValueOnce({ matchedCount: 1 });
    const service = new FoodScanUsageService(connectionFor({ updateOne, findOne: async () => ({ userId: user, generation: 0 }) }) as never);
    await service.finish('id', 'success', { input: 3, output: 2, total: 5 });
    expect(updateOne).toHaveBeenCalledTimes(2);
    expect(updateOne.mock.calls[1][1].$set).toMatchObject({ status: 'success', total: 5 });
  });
  it('filters summary by authenticated user', async () => {
    const aggregate = vi.fn(() => ({ toArray: async () => [] }));
    const service = new FoodScanUsageService({ db: { collection: () => ({ aggregate, createIndex: vi.fn().mockResolvedValue('user_index') }) } } as never);
    const summary = await service.summary(user);
    expect(String(aggregate.mock.calls[0][0][0].$match.userId)).toBe(user);
    expect(summary).toMatchObject({ scans: 0, input_tokens: null, estimated_cost: null });
  });
  it('records usage on failed analysis and does not call analysis when begin fails', async () => {
    const usage = { begin: vi.fn().mockResolvedValue('id'), finish: vi.fn() };
    const analyze = vi.fn(async (_body, _id, callback) => { callback({ input: 9, output: null, total: 9 }); throw new Error('bad output'); });
    const controller = new FoodScanController({ analyze } as never, usage as never, { value: { gemini: { model: 'test' } } } as never);
    await expect(controller.analyze({ user: { userId: user }, requestId: 'r' } as never, {})).rejects.toThrow();
    expect(usage.finish).toHaveBeenCalledWith('id', 'failure', { input: 9, output: null, total: 9 }, 'invalid_or_internal', true);
    usage.begin.mockRejectedValueOnce(new Error('db offline')); analyze.mockClear();
    await expect(controller.analyze({ user: { userId: user }, requestId: 'r2' } as never, {})).rejects.toThrow();
    expect(analyze).not.toHaveBeenCalled();
  });
  it('adds reported retry usage and marks missing attempts incomplete', async () => {
    const usage = { begin: vi.fn().mockResolvedValue('id'), finish: vi.fn() };
    const analyze = vi.fn(async (_body, _id, callback) => { callback({ input: 2, output: 1, total: 3 }); callback(null); callback({ input: 10, output: 3, total: 13 }); return {}; });
    const controller = new FoodScanController({ analyze } as never, usage as never, { value: { gemini: { model: 'test' } } } as never);
    await controller.analyze({ user: { userId: user }, requestId: 'r' } as never, {});
    expect(usage.finish).toHaveBeenCalledWith('id', 'success', { input: 12, output: 4, total: 16 }, undefined, false);
  });
});
