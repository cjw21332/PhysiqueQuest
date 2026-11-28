import { describe, expect, it, vi } from 'vitest';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { RolesGuard } from '../auth/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

describe('admin dashboard access and data', () => {
  it('requires an authenticated admin for every endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminDashboardController)).toEqual(['admin']);
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminDashboardController)).toEqual([JwtAuthGuard, RolesGuard]);
  });
  it('rejects malformed user IDs before querying', async () => {
    const collection = vi.fn();
    const controller = new AdminDashboardController({ collection } as never);
    await expect(controller.user('invalid')).rejects.toThrow('Invalid user ID');
    expect(collection).not.toHaveBeenCalled();
  });
  it('selects only the intended profile fields', async () => {
    const findOne = vi.fn().mockResolvedValueOnce({name: 'Member'}).mockResolvedValueOnce({goal: 'Strength'});
    const controller = new AdminDashboardController({ collection: () => ({ findOne }) } as never);
    await controller.user('507f1f77bcf86cd799439011');
    const projection = findOne.mock.calls[1][1].projection;
    expect(findOne.mock.calls[0][0].role).toEqual({$in:['user',null]});
    expect(projection.goal).toBe(1);
    expect(projection.healthNotes).toBeUndefined();
    expect(projection.injuries).toBeUndefined();
    expect(projection.contactPhone).toBeUndefined();
  });
});

describe('reviewed pose evidence', () => {
  it('rejects invalid counts before writing', async () => {
    const collection = vi.fn();
    const controller = new AdminDashboardController({ collection } as never);
    await expect(controller.addEvidence({ exercise: 'Squat', verified: -1, predicted: 2 }, { user: { userId: 'admin' } })).rejects.toThrow();
    expect(collection).not.toHaveBeenCalled();
  });
  it('reports 80% agreement for four predicted out of five verified reps', async () => {
    const rows = [{ _id: 'Squat', sets: 1, verified: 5, error: 1, zeroRepSets: 0, zeroRepFalsePositives: 0, lastReviewed: new Date() }];
    const controller = new AdminDashboardController({ collection: () => ({ aggregate: () => ({ toArray: async () => rows }) }) } as never);
    expect((await controller.poseEvidence())[0].agreement).toBe(80);
  });
  it('does not invent agreement for zero verified reps', async () => {
    const rows = [{ _id: 'Squat', sets: 1, verified: 0, error: 0, zeroRepSets: 1, zeroRepFalsePositives: 1, lastReviewed: new Date() }];
    const controller = new AdminDashboardController({ collection: () => ({ aggregate: () => ({ toArray: async () => rows }) }) } as never);
    expect((await controller.poseEvidence())[0]).toMatchObject({ agreement: null, zeroRepFalsePositives: 1 });
  });
});

describe('feedback management', () => {
  it('rejects invalid filter values and impossible dates', async () => {
    const controller = new AdminDashboardController({collection:()=>({})} as never);
    await expect(controller.feedback('1', 'unknown')).rejects.toThrow('Invalid status');
    await expect(controller.feedback('1', '', '', '', '', '', '', '2026-02-30')).rejects.toThrow('Invalid date');
  });
  it('validates the update before writing', async () => {
    const collection = vi.fn();
    const controller = new AdminDashboardController({collection} as never);
    await expect(controller.updateFeedback('507f1f77bcf86cd799439011', {status:'unexpected',note:''}, {user:{userId:'admin'}})).rejects.toThrow('Invalid feedback update');
    await expect(controller.updateFeedback('507f1f77bcf86cd799439011', {status:['new'],note:''}, {user:{userId:'admin'}})).rejects.toThrow('Invalid feedback update');
    expect(collection).not.toHaveBeenCalled();
  });
  it('audits successful feedback updates without recording note contents', async () => {
    const updateOne = vi.fn().mockResolvedValue({matchedCount:1});
    const audit = vi.fn().mockResolvedValue(undefined);
    const controller = new AdminDashboardController({collection:()=>({updateOne})} as never, undefined, undefined, {audit} as never);
    await controller.updateFeedback('507f1f77bcf86cd799439011', {status:'resolved',note:'private note'}, {user:{userId:'admin'}});
    expect(updateOne).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(audit.mock.calls)).not.toContain('private note');
  });
});
