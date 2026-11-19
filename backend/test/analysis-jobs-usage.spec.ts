import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AnalysisJobsService } from '../src/jobs/analysis-jobs.service.js';
import { OPENAI_MODEL } from '../src/common/openai.js';

describe('background food scanner usage', () => {
  it('reserves and records provider usage before completing a job', async () => {
    const userId = new Types.ObjectId(), jobId = new Types.ObjectId();
    const jobs = { updateMany: vi.fn(), findOneAndUpdate: vi.fn().mockResolvedValue({ _id: jobId, userId, generation: 0, lease: 'lease', payload: { userId: String(userId), resourceId: String(new Types.ObjectId()) } }), updateOne: vi.fn() };
    Object.assign(jobs, { aggregate: (pipeline: any[]) => ({ toArray: async () => pipeline[0].$match.status === 'pending' ? [{ _id: jobId, userId, generation: 0 }] : [] }) });
    const connection = { startSession: async () => ({ inTransaction: () => true, withTransaction: async (fn: () => Promise<void>) => fn(), endSession: async () => {} }), collection: (name: string) => name === 'analysis_jobs' ? jobs : { findOne: async () => ({ isActive: true, generation: 0 }), updateOne: async () => ({ matchedCount: 1 }) } };
    const storage = { analysisInput: vi.fn().mockResolvedValue({ image: 'test' }), markAnalyzed: vi.fn().mockRejectedValue(new Error('stop after scan')) };
    const scanner = { analyze: vi.fn(async (_input, _id, report) => { report({ input: 10, output: 2, total: 12 }); return {}; }) };
    const usage = { begin: vi.fn().mockResolvedValue('usage-id'), finish: vi.fn() };
    const service = new AnalysisJobsService(connection as never, storage as never, scanner as never, usage as never, { value: { gemini: { model: 'model' } } } as never);
    await service.tick();
    expect(usage.begin).toHaveBeenCalledWith(String(userId), `job:${jobId}`, OPENAI_MODEL);
    expect(usage.finish).toHaveBeenCalledWith('usage-id', 'success', { input: 10, output: 2, total: 12 }, undefined, true);
    expect(jobs.updateOne).toHaveBeenCalled();
  });
});
