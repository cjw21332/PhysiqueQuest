import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile } from '../profile/schemas/profile.schema.js';
import { Settings } from '../settings/schemas/settings.schema.js';
import { ExerciseDbService } from '../exercises/exercisedb.service.js';
import { CoachPlanner } from './coach-planner.js';
import { createHash } from 'node:crypto';
import { CoachProgram } from './coach-program.schema.js';

type Program = ReturnType<CoachPlanner['build']> & { source: string; programVersion?: string };

@Injectable()
export class CoachService {
  private readonly generating = new Map<string, Promise<Program>>();
  constructor(@InjectModel(Profile.name) private readonly profiles: Model<Profile>, @InjectModel(Settings.name) private readonly settings: Model<Settings>, private readonly exercises: ExerciseDbService, @InjectModel(CoachProgram.name) private readonly programs: Model<CoachProgram>) {}
  async getPlan(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException('Profile not found');
    const [profile, settings] = await Promise.all([
      this.profileModel(userId),
      this.settings.findOne({ userId: new Types.ObjectId(userId) }).lean().exec(),
    ]);
    const values = (settings as { values?: Record<string, unknown> } | null)?.values ?? {};
    const equipment = profile.equipment ?? (Array.isArray(values.equipment) ? values.equipment as string[] : []);
    const duration = profile.duration ?? (typeof values.duration === 'string' ? values.duration : '45 min');
    const context = { ...profile, equipment, duration };
    const schedule = new CoachPlanner().build(context, []);
    const sorted = (values: string[]) => [...new Set(values.map(value => value.trim().toLowerCase()))].sort();
    const contextHash = createHash('sha256').update(JSON.stringify({
      version: 1, goal: profile.goal, days: schedule.days.filter(day => day.isWorkoutDay).map(day => day.index),
      duration, equipment: sorted(equipment), conditions: sorted(profile.conditions ?? []),
    })).digest('hex');
    const filter = { userId: new Types.ObjectId(userId), contextHash };
    const saved = await this.programs.findOne(filter).lean().exec();
    // Refresh the week label locally; exercise selection never needs a daily API call.
    if (saved) return { ...saved.plan, weekLabel: schedule.weekLabel, programVersion: contextHash } as Program;
    const key = `${userId}:${contextHash}`;
    const pending = this.generating.get(key);
    if (pending) return pending;
    const generation = (async (): Promise<Program> => {
      const library = (await this.exercises.getForPlan(equipment, profile.goal)).map(row => ({ ...row, id: row._id }));
      const plan = { ...new CoachPlanner().build(context, library), source: library.some(row => row.source === 'PhysiqueQuest') ? 'ExerciseDB V1 + PhysiqueQuest' : 'ExerciseDB V1' };
      if (!plan.libraryReady || !plan.days.some(day => day.exercises.length)) return plan;
      // Persist the user's program, not provider media. Details/GIFs are refreshed on opening the library.
      const snapshot = { ...plan, days: plan.days.map(day => ({ ...day, exercises: day.exercises.map(({ gifUrl: _gifUrl, ...exercise }) => exercise) })) };
      const stored = await this.programs.findOneAndUpdate(filter, { $setOnInsert: { ...filter, plan: snapshot } }, { upsert: true, new: true, runValidators: true }).lean().exec();
      return { ...stored!.plan, weekLabel: schedule.weekLabel, programVersion: contextHash } as Program;
    })();
    this.generating.set(key, generation);
    try { return await generation; } finally { this.generating.delete(key); }
  }
  private async profileModel(userId: string) {
    const profile = await this.profiles.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    if (!profile) throw new NotFoundException('Profile not found');
    return profile as unknown as Profile;
  }

}
