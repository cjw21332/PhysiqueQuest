import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile } from '../profile/schemas/profile.schema.js';
import { Settings } from '../settings/schemas/settings.schema.js';
import { ExerciseDbService } from '../exercises/exercisedb.service.js';
import { FeedbackService } from '../feedback/feedback.service.js';
import { ageBand, applyFeedback, CoachPlanner, type CoachFeedback } from './coach-planner.js';
import { createHash } from 'node:crypto';
import { CoachProgram } from './coach-program.schema.js';
import { z } from 'zod';
import { AccountLifecycleFence } from '../privacy/account-lifecycle-fence.js';
import { orderPlanWithOpenAI } from './openai-plan.js';

const exerciseSchema = z.object({ exerciseId: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(120), group: z.string().max(120), targetMuscle: z.string().max(120), equipment: z.string().max(120), tracking: z.enum(['Manual', 'AI tracked']), prescription: z.string().max(80).optional(), restBetweenSets: z.number().int().min(0).max(600).optional(), restAfterExercise: z.number().int().min(0).max(600).optional() }).strict();
const programVersion = z.string().regex(/^[a-f0-9]{64}$/);
const dayFields = { dayIndex: z.number().int().min(0).max(6), title: z.string().trim().min(1).max(80), exercises: z.array(exerciseSchema).max(50) };
const uniqueExercises = (day: { exercises: { exerciseId: string }[] }) => new Set(day.exercises.map(item => item.exerciseId)).size === day.exercises.length;
const dayUpdateSchema = z.object({ programVersion, ...dayFields }).strict().refine(uniqueExercises, 'Exercises must be unique');
// Replaces the whole week in one write: listed days become these sessions, every other day becomes a rest day.
const weekUpdateSchema = z.object({ programVersion, days: z.array(z.object(dayFields).strict().refine(uniqueExercises, 'Exercises must be unique')).min(1).max(7) }).strict()
  .refine(value => new Set(value.days.map(day => day.dayIndex)).size === value.days.length, 'Days must be unique');
type DayUpdate = z.infer<typeof dayUpdateSchema>;

type Program = ReturnType<CoachPlanner['build']> & { source: string; programVersion?: string };

export function coachProgramContext(profile: Profile, values: Record<string, unknown>, feedback: CoachFeedback[] = []) {
  const equipment = profile.equipment ?? (Array.isArray(values.equipment) ? values.equipment as string[] : []);
  const duration = profile.duration ?? (typeof values.duration === 'string' ? values.duration : '45 min');
  const injuries = profile.healthConsentAt ? profile.injuries ?? [] : [];
  const healthRisks = profile.healthConsentAt ? profile.healthRisks ?? [] : [];
  const context = { ...profile, injuries, healthRisks, equipment, duration };
  const schedule = new CoachPlanner().build(context, []);
  const sorted = (items: string[]) => [...new Set(items.map(value => value.trim().toLowerCase()))].sort();
  const contextHash = createHash('sha256').update(JSON.stringify({
    version: 2, goal: profile.goal, days: schedule.days.filter(day => day.isWorkoutDay).map(day => day.index),
    ...(ageBand(profile.age) !== 'under35' && { ageBand: ageBand(profile.age) }),
    ...(injuries.length && { injuries: sorted(injuries) }),
    ...(healthRisks.length && { healthRisks: sorted(healthRisks) }),
    duration, equipment: sorted(equipment), conditions: sorted(profile.conditions ?? []),
  })).digest('hex');
  return { context, contextHash, equipment, schedule };
}

@Injectable()
export class CoachService {
  private readonly generating = new Map<string, Promise<Program>>();
  constructor(@InjectModel(Profile.name) private readonly profiles: Model<Profile>, @InjectModel(Settings.name) private readonly settings: Model<Settings>, private readonly exercises: ExerciseDbService, @InjectModel(CoachProgram.name) private readonly programs: Model<CoachProgram>, private readonly feedback?: FeedbackService) {}
  /** Read the currently matching saved plan without generating a new one. */
  async getSavedPlanForAdmin(userId: string) {
    const profile = await this.profileModel(userId);
    const settings = await this.settings.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    const values = (settings as { values?: Record<string, unknown> } | null)?.values ?? {};
    const { contextHash } = coachProgramContext(profile, values);
    const saved = await this.programs.findOne({ userId: new Types.ObjectId(userId), contextHash }).lean().exec();
    if (!saved || !Array.isArray(saved.plan?.days)) return null;
    return saved.plan.days.map((day: { label?: string; name?: string; title?: string; isWorkoutDay?: boolean; exercises?: { name?: string }[] }) => ({
      label: day.label ?? day.name ?? day.title ?? '', isWorkoutDay: Boolean(day.isWorkoutDay),
      exercises: Array.isArray(day.exercises) ? day.exercises.map(exercise => exercise.name).filter(Boolean) : [],
    }));
  }
  /** `withFeedback: false` returns the stored plan without feedback adjustments, so edits never bake them in. */
  async getPlan(userId: string, withFeedback = true) {
    const fence = new AccountLifecycleFence(this.programs.db);
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException('Profile not found');
    const [profile, settings, lifecycleGeneration, reports] = await Promise.all([
      this.profileModel(userId),
      this.settings.findOne({ userId: new Types.ObjectId(userId) }).lean().exec(),
      fence.generation(userId),
      this.feedback?.list(userId, 20) ?? [],
    ]);
    const values = (settings as { values?: Record<string, unknown> } | null)?.values ?? {};
    const feedback = reports.map(({ exercise, rpe, difficulty, enjoyment, painLocations }) => ({
      exercise, rpe, difficulty, enjoyment, pain: Boolean(painLocations?.some(location => location.trim())),
    }));
    const { equipment, context, schedule, contextHash } = coachProgramContext(profile, values, feedback);
    const filter = { userId: new Types.ObjectId(userId), contextHash };
    const saved = await this.programs.findOne(filter).lean().exec();
    // Refresh the week label locally; exercise selection never needs a daily API call.
    // Feedback adjusts sets, reps and tips on read; it never regenerates or reorders the stored plan.
    const adjust = (plan: Program) => withFeedback ? applyFeedback(plan, feedback) : plan;
    if (saved) return adjust({ ...saved.plan, weekLabel: schedule.weekLabel, ageNote: schedule.ageNote, programVersion: contextHash } as Program);
    const key = `${userId}:${lifecycleGeneration}:${contextHash}`;
    const pending = this.generating.get(key);
    if (pending) return pending;
    const generation = (async (): Promise<Program> => {
      const library = (await this.exercises.getForPlan(equipment, profile.goal)).map(row => ({ ...row, id: row._id }));
      const base = new CoachPlanner().build(context, library, feedback);
      let ordered = base;
      if (base.libraryReady && base.days.some(day => day.exercises.length)) {
        try { ordered = await orderPlanWithOpenAI(base); }
        catch { throw new ServiceUnavailableException('Workout planning is temporarily unavailable. Please try again.'); }
      }
      const plan = { ...ordered, source: ordered.days.some(day => day.exercises.length) ? 'ExerciseDB V1 + OpenAI' : 'ExerciseDB V1' };
      if (!plan.libraryReady || !plan.days.some(day => day.exercises.length)) return { ...plan, programVersion: contextHash };
      // Persist the user's program, not provider media. Details/GIFs are refreshed on opening the library.
      const snapshot = { ...plan, days: plan.days.map(day => ({ ...day, exercises: day.exercises.map(({ gifUrl: _gifUrl, ...exercise }) => exercise) })) };
      const stored = await fence.withActiveWrite(userId, async session => this.programs.findOneAndUpdate(filter, { $setOnInsert: { ...filter, plan: snapshot } }, { upsert: true, new: true, runValidators: true, session }).lean().exec(), lifecycleGeneration);
      return adjust({ ...stored!.plan, weekLabel: schedule.weekLabel, ageNote: schedule.ageNote, programVersion: contextHash } as Program);
    })();
    this.generating.set(key, generation);
    try { return await generation; } finally { this.generating.delete(key); }
  }
  async updateDay(userId: string, body: unknown) {
    const parsed = dayUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid day or exercise details.');
    return this.writeDays(userId, parsed.data.programVersion, [parsed.data], false);
  }
  async replaceWeek(userId: string, body: unknown) {
    const parsed = weekUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid days or exercise details.');
    return this.writeDays(userId, parsed.data.programVersion, parsed.data.days, true);
  }
  private async writeDays(userId: string, programVersion: string, updates: Omit<DayUpdate, 'programVersion'>[], restOthers: boolean) {
    const fence = new AccountLifecycleFence(this.programs.db), generation = await fence.generation(userId);
    const current = await this.getPlan(userId, false);
    if (current.programVersion !== programVersion) throw new ConflictException('Your plan changed. Refresh it before saving.');
    const byIndex = new Map(updates.map(update => [update.dayIndex, update]));
    const days = current.days.map(day => {
      const update = byIndex.get(day.index);
      if (update) return { ...day, title: update.title, focus: update.title, isWorkoutDay: update.exercises.length > 0, exercises: update.exercises, formTip: null, availabilityNote: null, equipmentLabel: [...new Set(update.exercises.map(item => item.equipment).filter(Boolean))].join(' + ') };
      return restOthers ? { ...day, title: day.index === 6 ? 'Rest day' : 'Recovery day', focus: null, isWorkoutDay: false, exercises: [], formTip: null, availabilityNote: null, equipmentLabel: '' } : day;
    });
    const plan = { ...current, days, sessionCount: days.filter(day => day.isWorkoutDay).length, libraryReady: current.libraryReady || updates.some(update => update.exercises.length > 0) };
    delete plan.programVersion;
    await fence.withActiveWrite(userId, async session => this.programs.findOneAndUpdate({ userId: new Types.ObjectId(userId), contextHash: programVersion }, { $set: { plan } }, { upsert: true, new: true, runValidators: true, session }).exec(), generation);
    return this.getPlan(userId);
  }
  private async profileModel(userId: string) {
    const profile = await this.profiles.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    if (!profile) throw new NotFoundException('Profile not found');
    return profile as unknown as Profile;
  }

}
