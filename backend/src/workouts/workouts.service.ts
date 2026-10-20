import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import {
  CompleteWorkoutDto,
  CreateWorkoutDto,
  PauseWorkoutDto,
  RecordedWorkoutDto,
  SaveSetDto,
  ApplyRecordingDto,
} from './dto/workout.dto.js';
import { WorkoutSession } from './schemas/workout-session.schema.js';
import { activityDate, calendarWeekday, plannedDayResults, shiftCalendarDate, validCalendarDate, workoutCalendarDate, workoutCreditFilter, type SetResult, type WorkoutRecord } from './workout-contract.js';

const hash = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(
              Object.keys(item)
                .sort()
                .map((key) => [key, item[key]]),
            )
          : item,
      ),
    )
    .digest('hex');
@Injectable()
export class WorkoutsService implements OnModuleInit {
  constructor(
    @InjectModel(WorkoutSession.name)
    private readonly model: Model<WorkoutSession>,
  ) {}
  async onModuleInit() {
    await this.model.init();
  }
  private validTime(value: string, name: string) {
    const date = new Date(value);
    if (
      !Number.isFinite(date.getTime()) ||
      date.getTime() > Date.now() + 60_000
    )
      throw new BadRequestException(`${name} is invalid or in the future`);
    return date;
  }
  private async insertOnce(
    userId: string,
    requestKey: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const user = new Types.ObjectId(userId);
    if (!requestKey) return this.model.create({ userId: user, ...payload });
    const requestHash = hash(payload),
      filter = { userId: user, requestKey };
    let record;
    try {
      record = await this.model.findOneAndUpdate(
        filter,
        { $setOnInsert: { ...payload, ...filter, requestHash } },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      record = await this.model.findOne(filter).exec();
    }
    if (!record || record.requestHash !== requestHash)
      throw new ConflictException(
        'This save key was already used for different data.',
      );
    return record;
  }
  async create(userId: string, dto: CreateWorkoutDto) {
    const startedAt = this.validTime(dto.startedAt, 'Workout start time');
    if (dto.scheduledDate && (dto.origin !== 'planned' || !validCalendarDate(dto.scheduledDate) || calendarWeekday(dto.scheduledDate) !== dto.dayIndex))
      throw new BadRequestException('The scheduled date must match the selected plan weekday.');
    if (dto.origin === 'planned' && !dto.exercises?.length)
      throw new BadRequestException(
        'A planned workout needs exercise snapshots.',
      );
    if (
      dto.exercises &&
      (dto.exercises.length !== dto.exerciseIds.length ||
        dto.exercises.some(
          (exercise, index) => exercise.exerciseId !== dto.exerciseIds[index],
        ))
    )
      throw new BadRequestException(
        'Exercise snapshots must match the selected exercise IDs.',
      );
    return this.insertOnce(userId, dto.requestKey, {
      exerciseIds: dto.exerciseIds,
      exercises: dto.exercises ?? [],
      startedAt,
      status: 'active',
      pausedSeconds: 0,
      exerciseResults: [],
      sets: [],
      revision: 0,
      origin: dto.origin ?? 'standalone',
      timezone: dto.timezone ?? 'UTC',
      programVersion: dto.programVersion,
      dayIndex: dto.dayIndex,
      scheduledDate: dto.scheduledDate,
      creditPolicyVersion: 2,
    });
  }
  async record(userId: string, dto: RecordedWorkoutDto) {
    const performedAt = this.validTime(dto.performedAt, 'Activity time');
    if (
      dto.exercise.exerciseId !== dto.result.exerciseId ||
      dto.result.setIndex !== 0 ||
      dto.result.status !== 'completed'
    )
      throw new BadRequestException(
        'The reviewed set must match this recording.',
      );
    const seconds = Math.floor(dto.result.clipDurationSeconds ?? 0);
    return this.insertOnce(userId, dto.requestKey, {
      exerciseIds: [dto.exercise.exerciseId],
      exercises: [{ ...dto.exercise, sets: 1 }],
      sets: [dto.result],
      exerciseResults: [
        {
          exerciseId: dto.result.exerciseId,
          reps: dto.result.reps,
          loadKg: dto.result.loadKg,
        },
      ],
      startedAt: performedAt,
      endedAt: performedAt,
      durationSeconds: seconds,
      status: 'completed',
      origin: 'recorded-set',
      timezone: dto.timezone,
      activityDate: activityDate(performedAt, dto.timezone),
      pausedSeconds: 0,
      revision: 1,
      creditPolicyVersion: 2,
    });
  }
  async list(userId: string, limit = 20, before?: string) {
    const [time, cursorId] = before?.split('|') ?? [];
    const boundary = time
      ? this.validTime(time, 'History boundary')
      : undefined;
    if (cursorId && !Types.ObjectId.isValid(cursorId))
      throw new BadRequestException('History cursor is invalid');
    return this.model
      .find({
        userId: new Types.ObjectId(userId),
        ...(boundary
          ? cursorId
            ? {
                $or: [
                  { startedAt: { $lt: boundary } },
                  {
                    startedAt: boundary,
                    _id: { $lt: new Types.ObjectId(cursorId) },
                  },
                ],
              }
            : { startedAt: { $lt: boundary } }
          : {}),
      })
      .sort({ startedAt: -1, _id: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
  }
  async forDay(userId: string, date: string, timezone = 'UTC') {
    if (!validCalendarDate(date)) throw new BadRequestException('Choose a valid workout date.');
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
    catch { throw new BadRequestException('Choose a valid timezone.'); }
    const monday = shiftCalendarDate(date, -calendarWeekday(date));
    // Bound legacy/planned candidates to the selected week, with timezone
    // padding. Include explicitly frozen activity dates for overnight sessions.
    const start = new Date(Date.parse(`${monday}T00:00:00Z`) - 36 * 60 * 60 * 1000);
    const end = new Date(Date.parse(`${shiftCalendarDate(monday, 7)}T00:00:00Z`) + 36 * 60 * 60 * 1000);
    const workouts = await this.model.find({
      userId: new Types.ObjectId(userId),
      $or: [{ scheduledDate: date }, { scheduledDate: { $exists: false }, startedAt: { $gte: start, $lt: end } }, { activityDate: date }],
    }).sort({ startedAt: -1, _id: -1 }).lean().exec();
    return workouts.filter(workout => workoutCalendarDate({ ...workout, startedAt: workout.startedAt.toISOString() }, timezone) === date);
  }
  async active(userId: string) {
    // Recovery follows the latest full session; ending it must not resurrect
    // an older abandoned session. Individual recorded sets are not sessions.
    const latest = await this.model
      .findOne({ userId: new Types.ObjectId(userId), origin: { $ne: 'recorded-set' } })
      .sort({ startedAt: -1, _id: -1 })
      .exec();
    return latest?.status === 'active' ? latest : null;
  }
  async detail(userId: string, id: string) {
    return this.owned(userId, id);
  }
  private async owned(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Workout not found');
    const workout = await this.model
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!workout) throw new NotFoundException('Workout not found');
    return workout;
  }
  private async change(
    userId: string,
    id: string,
    revision: number,
    patch: Record<string, unknown>,
  ) {
    const saved = await this.model.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        status: 'active',
        ...(revision === 0
          ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
          : { revision }),
      },
      { $set: patch, $inc: { revision: 1 } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!saved)
      throw new ConflictException(
        'This workout changed on another screen. Reload it before retrying.',
      );
    return saved;
  }
  async saveSet(userId: string, id: string, dto: SaveSetDto) {
    const workout = await this.owned(userId, id);
    if (workout.status !== 'active')
      throw new BadRequestException('This workout is already completed.');
    const incoming = dto.result,
      exercise = workout.exercises?.find(
        (item) => item.exerciseId === incoming.exerciseId,
      );
    const existing = workout.sets?.find((item) => item.setId === incoming.setId);
    // Association is assigned only by applyRecording; ordinary edits cannot
    // detach it and make the same original recording count a second time.
    const result: SetResult = { ...incoming, ...(existing?.sourceRecordingId ? { sourceRecordingId: existing.sourceRecordingId } : {}) };
    if (
      !exercise ||
      result.setIndex >= exercise.sets ||
      result.setId !== `${result.exerciseId}:${result.setIndex}`
    )
      throw new BadRequestException('Set does not belong to this workout.');
    if (existing && hash(existing) === hash(result)) return workout;
    if ((workout.revision ?? 0) !== dto.expectedRevision)
      throw new ConflictException('Reload this workout before retrying.');
    return this.change(userId, id, dto.expectedRevision, {
      sets: [
        ...(workout.sets ?? []).filter((item) => item.setId !== result.setId),
        result,
      ],
    });
  }
  async applyRecording(userId: string, recordingId: string, dto: ApplyRecordingDto) {
    if (!validCalendarDate(dto.scheduledDate) || calendarWeekday(dto.scheduledDate) !== dto.dayIndex)
      throw new BadRequestException('The scheduled date must match the selected plan weekday.');
    const recording = await this.owned(userId, recordingId);
    recordingId = String(recording._id);
    if (recording.origin !== 'recorded-set' || recording.status !== 'completed')
      throw new BadRequestException('Choose a completed recorded set.');
    if (workoutCalendarDate({ origin: recording.origin, timezone: recording.timezone, activityDate: recording.activityDate, startedAt: recording.startedAt.toISOString() }, dto.timezone) !== dto.scheduledDate)
      throw new BadRequestException('Apply this recording to its performed day.');
    const exercise = dto.exercises.find(item => item.exerciseId === dto.exerciseId);
    if (!exercise || new Set(dto.exercises.map(item => item.exerciseId)).size !== dto.exercises.length)
      throw new BadRequestException('Choose an exercise from the selected plan.');
    const legacy = recording.exerciseResults?.[0];
    const source: Omit<SetResult, 'setId' | 'setIndex'> | undefined = recording.sets?.find(set => set.status === 'completed') ??
      (legacy ? { exerciseId: legacy.exerciseId, reps: legacy.reps, loadKg: legacy.loadKg, status: 'completed', source: 'manual' } : undefined);
    const timed = /\d+\s*(?:s\b|sec|seconds|min)/i.test(exercise.prescription ?? '');
    if (!source || (timed ? !((source.durationSeconds ?? 0) > 0) : !(source.reps > 0)))
      throw new BadRequestException(timed ? 'This planned set needs a recorded hold duration.' : 'A recording with zero reps does not complete a planned set.');
    const claimed = await this.model.findOne({ userId: new Types.ObjectId(userId), appliedRecordingIds: recordingId }).exec();
    if (claimed) {
      if (claimed.programVersion === dto.programVersion && claimed.scheduledDate === dto.scheduledDate &&
        claimed.sets.some(set => set.sourceRecordingId === recordingId && set.exerciseId === dto.exerciseId)) return claimed;
      throw new ConflictException('This recording is already applied to a planned set.');
    }
    const day = await this.forDay(userId, dto.scheduledDate, dto.timezone);
    const records = day.map(workout => ({ ...workout, _id: String(workout._id), startedAt: workout.startedAt.toISOString() })) as WorkoutRecord[];
    const reviewed = plannedDayResults(records, dto.programVersion, dto.dayIndex, dto.scheduledDate, dto.timezone);
    const setIndex = Array.from({ length: exercise.sets }, (_, index) => index).find(index =>
      !reviewed.some(set => set.exerciseId === dto.exerciseId && set.setIndex === index));
    if (setIndex === undefined) throw new ConflictException('All planned sets for this exercise are already reviewed.');
    const candidate = day.find(workout => workout.origin === 'planned' && workout.status === 'active' &&
      workout.programVersion === dto.programVersion && workout.dayIndex === dto.dayIndex &&
      workout.exercises?.some(item => item.exerciseId === dto.exerciseId && item.sets > setIndex));
    const workout = candidate ? await this.owned(userId, String(candidate._id)) : await this.create(userId, {
      origin: 'planned', exercises: dto.exercises, exerciseIds: dto.exercises.map(item => item.exerciseId),
      programVersion: dto.programVersion, dayIndex: dto.dayIndex, scheduledDate: dto.scheduledDate, timezone: dto.timezone,
      startedAt: new Date().toISOString(), requestKey: `recorded-plan:${createHash('sha256').update(`${dto.programVersion}:${dto.scheduledDate}`).digest('hex')}`,
    });
    if (workout.sets?.some(set => set.exerciseId === dto.exerciseId && set.setIndex === setIndex))
      throw new ConflictException('This set changed. Reload the day before retrying.');
    const result: SetResult = {
      ...source, setId: `${dto.exerciseId}:${setIndex}`, exerciseId: dto.exerciseId, setIndex,
      status: 'completed', sourceRecordingId: recordingId,
    };
    try {
      return await this.change(userId, String(workout._id), workout.revision ?? 0, {
        sets: [...(workout.sets ?? []), result],
        scheduledDate: dto.scheduledDate,
        appliedRecordingIds: [...new Set([...(workout.appliedRecordingIds ?? []), recordingId])],
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictException('This recording was already applied. Reload the day before retrying.');
      throw error;
    }
  }
  async setPaused(userId: string, id: string, dto: PauseWorkoutDto) {
    const workout = await this.owned(userId, id);
    if (workout.status !== 'active')
      throw new BadRequestException('Completed workouts cannot be paused');
    const occurredAt = this.validTime(dto.occurredAt, 'Pause time');
    if (
      occurredAt < workout.startedAt ||
      (workout.pausedAt && occurredAt < workout.pausedAt)
    )
      throw new BadRequestException(
        'Pause time must be within the active workout',
      );
    if (dto.paused === Boolean(workout.pausedAt)) return workout;
    if (
      dto.expectedRevision !== undefined &&
      dto.expectedRevision !== (workout.revision ?? 0)
    )
      throw new ConflictException('Reload this workout before retrying.');
    const pausedSeconds =
      workout.pausedSeconds +
      (!dto.paused && workout.pausedAt
        ? Math.floor((occurredAt.getTime() - workout.pausedAt.getTime()) / 1000)
        : 0);
    return this.change(userId, id, workout.revision ?? 0, {
      pausedAt: dto.paused ? occurredAt : null,
      pausedSeconds,
    });
  }
  async complete(userId: string, id: string, dto: CompleteWorkoutDto) {
    const workout = await this.owned(userId, id),
      completionHash = hash({
        endedAt: dto.endedAt,
        exerciseResults: dto.exerciseResults,
      });
    if (workout.status === 'completed') {
      if (
        dto.expectedRevision !== undefined &&
        workout.completionHash &&
        workout.completionHash !== completionHash
      )
        throw new ConflictException(
          'Workout was already completed with different data.',
        );
      return workout;
    }
    const endedAt = this.validTime(dto.endedAt, 'End time');
    if (
      endedAt < workout.startedAt ||
      (workout.pausedAt && endedAt < workout.pausedAt)
    )
      throw new BadRequestException('End time must be within the workout');
    if (
      dto.expectedRevision !== undefined &&
      dto.expectedRevision !== (workout.revision ?? 0)
    )
      throw new ConflictException('Reload this workout before retrying.');
    if (
      workout.exercises?.length &&
      workout.exercises.some((exercise) =>
        Array.from(
          { length: exercise.sets },
          (_, index) => `${exercise.exerciseId}:${index}`,
        ).some((key) => !workout.sets.some((set) => set.setId === key)),
      )
    )
      throw new BadRequestException(
        'Review or skip every planned set before finishing.',
      );
    const elapsed = Math.max(
      0,
      Math.floor((endedAt.getTime() - workout.startedAt.getTime()) / 1000) -
        workout.pausedSeconds -
        (workout.pausedAt
          ? Math.floor((endedAt.getTime() - workout.pausedAt.getTime()) / 1000)
          : 0),
    );
    const results = workout.sets?.length
      ? workout.exercises.map((exercise) => {
          const sets = workout.sets.filter(
            (set) =>
              set.exerciseId === exercise.exerciseId &&
              set.status === 'completed',
          );
          return {
            exerciseId: exercise.exerciseId,
            reps: sets.reduce((sum, set) => sum + set.reps, 0),
            ...(sets.some((set) => set.loadKg !== undefined)
              ? { loadKg: Math.max(...sets.map((set) => set.loadKg ?? 0)) }
              : {}),
          };
        })
      : dto.exerciseResults;
    try {
      return await this.change(userId, id, workout.revision ?? 0, {
        endedAt,
        durationSeconds: elapsed,
        exerciseResults: results,
        status: 'completed',
        completionHash,
        activityDate: activityDate(endedAt, workout.timezone),
        creditPolicyVersion: workout.creditPolicyVersion ?? 1,
      });
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      const replay = await this.owned(userId, id);
      if (
        replay.status === 'completed' &&
        replay.completionHash === completionHash
      )
        return replay;
      throw error;
    }
  }
  async summary(userId: string, timezone = 'UTC') {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      throw new BadRequestException('Timezone is invalid');
    }
    const [result] = await this.model.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'completed',
          endedAt: { $type: 'date' },
        },
      },
      {
        $set: {
          day: {
            $ifNull: [
              '$activityDate',
              {
                $dateToString: {
                  date: '$endedAt',
                  format: '%Y-%m-%d',
                  timezone: { $ifNull: ['$timezone', timezone] },
                },
              },
            ],
          },
        },
      },
      {
        $facet: {
          dates: [
            { $match: workoutCreditFilter },
            { $group: { _id: '$day' } },
            { $sort: { _id: 1 } },
          ],
          personalRecords: [
            { $unwind: '$sets' },
            { $match: { 'sets.status': 'completed' } },
            {
              $sort: {
                'sets.loadKg': -1,
                'sets.reps': -1,
                'sets.durationSeconds': -1,
                endedAt: -1,
              },
            },
            {
              $group: {
                _id: '$sets.exerciseId',
                best: { $first: '$sets' },
                exercises: { $first: '$exercises' },
                date: { $first: '$day' },
              },
            },
            {
              $project: {
                _id: 0,
                exerciseId: '$_id',
                name: {
                  $let: {
                    vars: {
                      exercise: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$exercises',
                              as: 'exercise',
                              cond: { $eq: ['$$exercise.exerciseId', '$_id'] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: { $ifNull: ['$$exercise.name', '$_id'] },
                  },
                },
                reps: '$best.reps',
                durationSeconds: '$best.durationSeconds',
                loadKg: '$best.loadKg',
                date: 1,
              },
            },
          ],
        },
      },
    ]);
    return {
      trainingDates: (result?.dates ?? []).map(
        (row: { _id: string }) => row._id,
      ),
      personalRecords: result?.personalRecords ?? [],
      policyVersion: 2,
    };
  }
  async creditHistory(userId: string, timezone = 'UTC') {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      throw new BadRequestException('Timezone is invalid');
    }
    return this.model.aggregate<{
      status: 'completed';
      endedAt: Date;
      activityDate: string;
    }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: 'completed',
          endedAt: { $type: 'date' },
          ...workoutCreditFilter,
        },
      },
      {
        $group: {
          _id: {
            $ifNull: [
              '$activityDate',
              {
                $dateToString: {
                  date: '$endedAt',
                  format: '%Y-%m-%d',
                  timezone: { $ifNull: ['$timezone', timezone] },
                },
              },
            ],
          },
          endedAt: { $max: '$endedAt' },
        },
      },
      {
        $project: {
          _id: 0,
          status: { $literal: 'completed' },
          activityDate: '$_id',
          endedAt: 1,
        },
      },
    ]);
  }
}
