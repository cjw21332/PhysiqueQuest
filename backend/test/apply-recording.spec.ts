import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import { WorkoutSessionSchema } from '../src/workouts/schemas/workout-session.schema.js';
import { SaveSetDto } from '../src/workouts/dto/workout.dto.js';
import { setProgress } from '../src/workouts/workout-contract.js';

const userId = '507f1f77bcf86cd799439011';
const recordingId = '507f1f77bcf86cd799439012';
const plan = { programVersion: 'current', dayIndex: 0, scheduledDate: '2026-10-12', timezone: 'Asia/Taipei', exerciseId: 'catalog-pushup', exercises: [
  { exerciseId: 'catalog-pullup', name: 'Pull-up', equipment: 'Bodyweight', prescription: '3 × 12', sets: 3 },
  { exerciseId: 'catalog-pushup', name: 'Push-up', equipment: 'Bodyweight', prescription: '3 × 12', sets: 3 },
  { exerciseId: 'catalog-row', name: 'Bodyweight row', equipment: 'Bodyweight', prescription: '3 × 12', sets: 3 },
] };

function fixture(reps = 4) {
  const docs: any[] = [{ _id: recordingId, userId, origin: 'recorded-set', status: 'completed', startedAt: new Date('2026-10-12T03:00:00Z'), activityDate: '2026-10-12', timezone: 'Asia/Taipei', exerciseIds: ['movement-pushup'], exercises: [{ exerciseId: 'movement-pushup', name: 'Push-up', equipment: 'Bodyweight', sets: 1 }], sets: [{ setId: 'movement-pushup:0', exerciseId: 'movement-pushup', setIndex: 0, reps, detectedReps: 3, status: 'completed', source: 'local-video', trackingPresetId: 'camera-pushup', algorithmVersion: 'movement-rules-v1/rep-counter-v2' }] }];
  const copy = (doc: any) => doc && ({ ...doc, sets: doc.sets?.map((set: any) => ({ ...set })), appliedRecordingIds: [...(doc.appliedRecordingIds ?? [])] });
  const match = (doc: any, filter: any) => (!filter._id || String(doc._id) === String(filter._id)) &&
    (!filter.userId || String(doc.userId) === String(filter.userId)) &&
    (!filter.requestKey || doc.requestKey === filter.requestKey) &&
    (!filter.appliedRecordingIds || doc.appliedRecordingIds?.includes(filter.appliedRecordingIds));
  let failNext: 'revision' | 'duplicate' | undefined;
  const model: any = {
    findOne: vi.fn((filter: any) => ({ exec: async () => copy(docs.find(doc => match(doc, filter))) ?? null })),
    find: vi.fn((filter: any) => ({ sort: () => ({ lean: () => ({ exec: async () => docs.filter(doc => match(doc, filter)).map(copy) }) }) })),
    findOneAndUpdate: vi.fn(async (filter: any, update: any) => {
      let doc = docs.find(item => match(item, filter));
      if (update.$setOnInsert) {
        if (!doc) { doc = { _id: new Types.ObjectId().toString(), ...update.$setOnInsert, sets: [], appliedRecordingIds: [] }; docs.push(doc); }
        return copy(doc);
      }
      if (failNext === 'duplicate') { failNext = undefined; throw { code: 11000 }; }
      if (failNext === 'revision') { failNext = undefined; return null; }
      if (!doc || doc.status !== 'active' || (filter.revision !== undefined && doc.revision !== filter.revision)) return null;
      for (const id of update.$set.appliedRecordingIds ?? []) if (docs.some(other => other !== doc && other.userId === doc.userId && other.appliedRecordingIds?.includes(id))) throw { code: 11000 };
      Object.assign(doc, update.$set, { revision: (doc.revision ?? 0) + 1 });
      return copy(doc);
    }),
  };
  return { service: new WorkoutsService(model), docs, model, failNext: (value: typeof failNext) => { failNext = value; } };
}

describe('applying reviewed recordings to a planned set', () => {
  it('applies four reviewed reps as one set, leaves eight remaining, and is idempotent', async () => {
    const { service, docs } = fixture();
    const saved = await service.applyRecording(userId, recordingId, plan);
    expect(saved.origin).toBe('planned'); expect(saved.status).toBe('active');
    expect(saved.scheduledDate).toBe('2026-10-12');
    expect(saved.sets[0]).toMatchObject({ exerciseId: 'catalog-pushup', setIndex: 0, reps: 4, detectedReps: 3, source: 'local-video', sourceRecordingId: recordingId });
    expect(setProgress(saved.exercises, saved.sets)).toMatchObject({ total: 9, completed: 1, remaining: 8 });
    expect(await service.applyRecording(userId, recordingId, plan)).toMatchObject({ _id: saved._id, revision: 1 });
    expect(await service.applyRecording(userId, recordingId.toUpperCase(), plan)).toMatchObject({ _id: saved._id, revision: 1 });
    expect(docs).toHaveLength(2);
    expect(docs[0].sets[0].exerciseId).toBe('movement-pushup');
  });
  it('never turns zero reps into a completed planned set', async () => {
    const { service, docs } = fixture(0);
    await expect(service.applyRecording(userId, recordingId, plan)).rejects.toBeInstanceOf(BadRequestException);
    expect(docs).toHaveLength(1);
  });
  it('reuses an existing session and fills only its next unreviewed prescribed slot', async () => {
    const { service, docs } = fixture();
    docs.push({ _id: '507f1f77bcf86cd799439013', userId, origin: 'planned', status: 'active', programVersion: plan.programVersion, dayIndex: 0, startedAt: new Date('2026-10-12T02:00:00Z'), timezone: plan.timezone, exercises: plan.exercises, exerciseIds: plan.exercises.map(exercise => exercise.exerciseId), revision: 7, sets: [
      { setId: 'catalog-pushup:0', exerciseId: 'catalog-pushup', setIndex: 0, reps: 12, status: 'completed', source: 'manual' },
      { setId: 'catalog-pushup:1', exerciseId: 'catalog-pushup', setIndex: 1, reps: 0, status: 'skipped', source: 'manual' },
    ] });
    const saved = await service.applyRecording(userId, recordingId, plan);
    expect(docs).toHaveLength(2); expect(saved.revision).toBe(8);
    expect(saved.scheduledDate).toBe('2026-10-12');
    expect(saved.sets.at(-1)).toMatchObject({ setIndex: 2, reps: 4, sourceRecordingId: recordingId });
    expect(saved.sets[0].reps).toBe(12);
    expect(setProgress(saved.exercises, saved.sets)).toMatchObject({ completed: 2, skipped: 1, remaining: 6 });
    expect((await service.applyRecording(userId, recordingId, plan)).revision).toBe(8);
  });
  it('does not overwrite a reviewed slot when another screen changes the session', async () => {
    const f = fixture();
    const target = { _id: '507f1f77bcf86cd799439013', userId, origin: 'planned', status: 'active', programVersion: plan.programVersion, dayIndex: 0, scheduledDate: plan.scheduledDate, startedAt: new Date('2026-10-12T02:00:00Z'), timezone: plan.timezone, exercises: plan.exercises, exerciseIds: plan.exercises.map(exercise => exercise.exerciseId), revision: 1, sets: [{ setId: 'catalog-pushup:0', exerciseId: 'catalog-pushup', setIndex: 0, reps: 15, status: 'completed', source: 'manual' }] };
    f.docs.push(target);
    vi.spyOn(f.service, 'forDay').mockResolvedValue([{ ...target, sets: [] }] as any);
    await expect(f.service.applyRecording(userId, recordingId, plan)).rejects.toBeInstanceOf(ConflictException);
    expect(target.sets[0].reps).toBe(15);
    expect(target.sets).toHaveLength(1);
  });
  it('rejects another user, another date, another weekday and non-recording sources', async () => {
    const { service, docs } = fixture();
    await expect(service.applyRecording('507f1f77bcf86cd799439099', recordingId, plan)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.applyRecording(userId, recordingId, { ...plan, scheduledDate: '2026-10-19' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.applyRecording(userId, recordingId, { ...plan, dayIndex: 1 })).rejects.toBeInstanceOf(BadRequestException);
    docs[0].origin = 'planned';
    await expect(service.applyRecording(userId, recordingId, plan)).rejects.toBeInstanceOf(BadRequestException);
    expect(docs).toHaveLength(1);
  });
  it('will not reuse one recording for another exercise or program', async () => {
    const { service } = fixture();
    await service.applyRecording(userId, recordingId, plan);
    await expect(service.applyRecording(userId, recordingId, { ...plan, exerciseId: 'catalog-pullup' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.applyRecording(userId, recordingId, { ...plan, programVersion: 'different' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('preserves the recording association when the user edits or skips the imported set', async () => {
    const { service } = fixture();
    const saved = await service.applyRecording(userId, recordingId, plan);
    const edited = await service.saveSet(userId, String(saved._id), { expectedRevision: saved.revision, result: { setId: 'catalog-pushup:0', exerciseId: 'catalog-pushup', setIndex: 0, reps: 0, status: 'skipped', source: 'manual' } });
    expect(edited.sets[0].sourceRecordingId).toBe(recordingId);
    expect(edited.appliedRecordingIds).toEqual([recordingId]);
    expect((await service.applyRecording(userId, recordingId, plan)).sets).toHaveLength(1);
  });
  it('retries a lost revision without creating another session', async () => {
    const f = fixture(); f.failNext('revision');
    await expect(f.service.applyRecording(userId, recordingId, plan)).rejects.toBeInstanceOf(ConflictException);
    const saved = await f.service.applyRecording(userId, recordingId, plan);
    expect(saved.sets).toHaveLength(1); expect(f.docs).toHaveLength(2);
  });
  it('turns a duplicate recording claim into a safe conflict', async () => {
    const f = fixture(); f.failNext('duplicate');
    await expect(f.service.applyRecording(userId, recordingId, plan)).rejects.toThrow('already applied');
    expect(f.docs[1].sets).toHaveLength(0);
  });
  it('requires a recorded duration for a timed plan and rejects unrelated exercise IDs', async () => {
    const { service } = fixture();
    await expect(service.applyRecording(userId, recordingId, { ...plan, exercises: [{ ...plan.exercises[1], prescription: '3 × 30 s' }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.applyRecording(userId, recordingId, { ...plan, exerciseId: 'unknown' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('reserves provenance fields for the server and declares a unique per-owner recording claim', async () => {
    const dto = plainToInstance(SaveSetDto, { expectedRevision: 0, result: { setId: 'catalog-pushup:0', exerciseId: 'catalog-pushup', setIndex: 0, reps: 4, status: 'completed', source: 'manual', sourceRecordingId: recordingId } });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
    const index = WorkoutSessionSchema.indexes().find(([keys]) => keys.appliedRecordingIds === 1);
    expect(index?.[1]).toMatchObject({ unique: true, partialFilterExpression: { appliedRecordingIds: { $type: 'string' } } });
  });
});
