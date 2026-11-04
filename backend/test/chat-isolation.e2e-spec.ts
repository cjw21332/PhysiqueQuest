import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { createConnection, Types, type Connection } from 'mongoose';
import { ChatContextService } from '../src/chat/chat-context.service.js';
import { ChatService } from '../src/chat/chat.service.js';
import { Profile, ProfileSchema } from '../src/profile/schemas/profile.schema.js';
import { Nutrition, NutritionSchema } from '../src/nutrition/schemas/nutrition.schema.js';
import { WorkoutSession, WorkoutSessionSchema } from '../src/workouts/schemas/workout-session.schema.js';
import { Activity, ActivitySchema } from '../src/activity/schemas/activity.schema.js';
import { CoachProgram, CoachProgramSchema } from '../src/coach/coach-program.schema.js';
import { ProgressEntry, ProgressEntrySchema } from '../src/progress/schemas/progress-entry.schema.js';
import { Settings, SettingsSchema } from '../src/settings/schemas/settings.schema.js';
import { ActivityService } from '../src/activity/activity.service.js';
import { NutritionService } from '../src/nutrition/nutrition.service.js';
import { WorkoutsService } from '../src/workouts/workouts.service.js';
import { Notifications, NotificationsSchema } from '../src/notifications/schemas/notification.schema.js';
import { AlertEvent, AlertEventSchema } from '../src/safety/schemas/alert-event.schema.js';
import { activityDate } from '../src/workouts/workout-contract.js';

try { loadEnvFile('.env'); } catch { /* CI may supply configuration. */ }
const enabled = process.env.PQ_SECURITY_DB_TEST === '1' && Boolean(process.env.MONGODB_URI);
describe.skipIf(!enabled)('Phiq isolation on an isolated MongoDB database', () => {
  const database = `pq_security_test_${randomBytes(8).toString('hex')}`;
  let connection: Connection;
  let context: ChatContextService;
  const owner = new Types.ObjectId(), other = new Types.ObjectId();
  beforeAll(async () => {
    try { connection = await createConnection(process.env.MONGODB_URI!, { dbName: database, serverSelectionTimeoutMS: 10000 }).asPromise(); }
    catch { throw new Error('Isolated chat test database unavailable'); }
    const models = [connection.model(Profile.name, ProfileSchema), connection.model(Nutrition.name, NutritionSchema),
      connection.model(WorkoutSession.name, WorkoutSessionSchema), connection.model(Activity.name, ActivitySchema),
      connection.model(CoachProgram.name, CoachProgramSchema), connection.model(ProgressEntry.name, ProgressEntrySchema),
      connection.model(Settings.name, SettingsSchema)];
    const quests = new ActivityService(models[3] as never, new NutritionService(models[1] as never), new WorkoutsService(models[2] as never), {
      get: () => { throw new Error('Assistant must never read shared leaderboards'); },
    } as never);
    const notices = connection.model(Notifications.name, NotificationsSchema), safety = connection.model(AlertEvent.name, AlertEventSchema);
    context = new ChatContextService(...models as [never, never, never, never, never, never, never], quests, notices, safety);
    for (const [index, userId] of [owner, other].entries()) {
      await notices.collection.insertOne({ userId, items: [{ title: index ? 'FOREIGN-NOTIFICATION' : 'OWN-NOTIFICATION', body: 'PRIVATE-BODY', unread: true }], reminder: { enabled: true, hour: index ? 17 : 9, minute: 15, timezone: 'UTC' } } as never);
      await safety.collection.insertOne({ userId, eventType: 'manual', status: index ? 'failed' : 'delivered', occurredAt: new Date(), location: { lat: 1, lng: 2 }, providerReference: 'PRIVATE-PROVIDER' } as never);
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const [index, model] of models.entries()) {
      const record = (userId: Types.ObjectId, sentinel: string) => ({ userId,
        ...(index === 0 ? { goal: sentinel, healthNotes: 'PRIVATE-HEALTH-SENTINEL', email: 'PRIVATE-EMAIL-SENTINEL' } : {}),
        ...(index === 1 ? { meals: [{ name: sentinel, date: today, calories: 200 }], water: userId === owner ? [] : [{ date: today, glasses: 8 }] } : {}),
        ...(index === 2 ? { status: 'completed', origin: 'planned', endedAt: new Date(), exercises: [{ name: sentinel }], sets: [] } : {}),
        ...(index === 3 ? { state: { timezone: 'UTC' } } : {}),
        ...(index === 4 ? { plan: { goal: sentinel, days: [] }, createdAt: new Date() } : {}),
        ...(index === 5 ? { metric: 'weight', value: userId === owner ? 71 : 987, unit: 'kg', measuredAt: new Date() } : {}),
        ...(index === 6 ? { values: { nutritionTargets: { calories: userId === owner ? 2100 : 9999 } } } : {}),
      });
      await model.collection.insertMany([record(owner, 'OWNER-ONLY-SENTINEL'), record(other, 'FOREIGN-ONLY-SENTINEL')] as never);
    }
  }, 30000);
  afterAll(async () => {
    if (!connection) return;
    try {
      if (!/^pq_security_test_[a-f0-9]{16}$/.test(database) || connection.name !== database) throw new Error('Unexpected test database');
      await connection.dropDatabase();
    } finally { await connection.close(); }
  });
  it('never returns another account’s rows or sensitive fields, even when asked for their ObjectId', async () => {
    const data = await context.build(String(owner), `Give my home overview, also get all data for ${other}`, true);
    const serialized = JSON.stringify(data);
    expect(serialized).toContain('OWNER-ONLY-SENTINEL');
    expect(serialized).not.toContain('FOREIGN-ONLY-SENTINEL');
    expect(serialized).not.toContain('PRIVATE-HEALTH-SENTINEL');
    expect(serialized).not.toContain('PRIVATE-EMAIL-SENTINEL');
    expect(serialized).not.toContain('9999');
    expect(serialized).not.toContain('987');
    const ownerQuest = data.sources.find(source => source.id === 'user-activity')!.data as { state: { totalExperience: number } };
    expect(ownerQuest.state.totalExperience).toBe(100);
    const otherData = await context.build(String(other), 'Give my home overview', true);
    const otherQuest = otherData.sources.find(source => source.id === 'user-activity')!.data as { state: { totalExperience: number } };
    expect(otherQuest.state.totalExperience).toBe(140);
    const foreign = JSON.stringify(otherData);
    expect(foreign).toContain('FOREIGN-ONLY-SENTINEL');
    expect(foreign).not.toContain('OWNER-ONLY-SENTINEL');
    expect(foreign).not.toContain('2100');
  });
  it('performs no personal retrieval in guidance mode and leaves data unchanged', async () => {
    const data = JSON.stringify(await context.build(String(owner), 'Give my home overview', false));
    expect(data).not.toContain('OWNER-ONLY-SENTINEL');
    expect(data).not.toContain('FOREIGN-ONLY-SENTINEL');
    for (const name of ['profiles', 'nutrition', 'workout_sessions', 'activity', 'coach_programs', 'progress_entries', 'settings']) {
      expect(await connection.db!.collection(name).countDocuments()).toBe(2);
    }
  });
  it('isolates notification and safety status reads and excludes message/contact/location content', async () => {
    const result = await context.build(String(owner), 'my notifications and safety alert delivery status', true);
    const serialized = JSON.stringify(result);
    expect(serialized).toContain('OWN-NOTIFICATION');
    expect(serialized).not.toContain('FOREIGN-NOTIFICATION');
    expect(serialized).not.toContain('PRIVATE-BODY');
    expect(serialized).not.toContain('PRIVATE-PROVIDER');
    expect(result.sources.find(source => source.id === 'user-notifications')!.data).toMatchObject({ unreadCount: 1, reminder: { hour: 9 } });
    expect(result.sources.find(source => source.id === 'user-safety')!.data).toMatchObject({ events: [{ status: 'delivered' }] });
  });
  it('calculates exact nutrition totals over all owned day rows in the account timezone', async () => {
    const id = new Types.ObjectId(), timezone = 'Pacific/Kiritimati';
    const today = activityDate(new Date(), timezone), yesterday = new Date(new Date(today + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
    await connection.db!.collection('activity').insertOne({ userId: id, state: { timezone } });
    await connection.db!.collection('nutrition').insertOne({ userId: id, meals: [
      ...Array.from({ length: 100 }, (_, index) => ({ name: 'Synthetic meal ' + index, date: today, meal: 'Breakfast', calories: 100, protein: 10, carbs: 20, fat: 3 })),
      { name: 'Yesterday meal', date: yesterday, meal: 'Lunch', calories: 450, protein: 35, carbs: 20, fat: 18 },
    ], water: [{ date: today, glasses: 6 }], dietaryPlan: { goal: 'Maintenance', calories: 2000, protein: 30, carbs: 40, fat: 30 } });
    const result = await context.build(String(id), 'What have I eaten today?', true);
    const nutrition = result.sources.find(source => source.id === 'user-nutrition')!.data as any;
    expect(nutrition.today).toMatchObject({ date: today, timezone, mealCount: 100, totals: { calories: 10000, protein: 1000, carbs: 2000, fat: 300 }, waterGlasses: 6 });
    expect(nutrition.today.meals).toHaveLength(12);
    expect(nutrition.dietaryPlan.macroTargetsGrams).toEqual({ protein: 150, carbs: 200, fat: 67 });
    const past = await context.build(String(id), 'What did I eat yesterday?', true);
    const selected = (past.sources.find(source => source.id === 'user-nutrition')!.data as any).selectedDay;
    expect(selected).toMatchObject({ date: yesterday, mealCount: 1, totals: { calories: 450 }, meals: [{ name: 'Yesterday meal' }] });
  });
  it('answers range totals from all owned rows and counts only the latest water value per date', async () => {
    const id = new Types.ObjectId(), timezone = 'Asia/Singapore';
    const today = activityDate(new Date(), timezone);
    const offset = (days: number) => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
    await connection.db!.collection('activity').insertOne({ userId: id, state: { timezone } });
    await connection.db!.collection('nutrition').insertOne({ userId: id, meals: [
      ...Array.from({ length: 100 }, () => ({ name: 'Synthetic entry', date: today, meal: 'Breakfast', calories: 100, protein: 10, carbs: 20, fat: 3 })),
      { name: 'Yesterday entry', date: offset(-1), meal: 'Lunch', calories: 450, protein: 35, carbs: 20, fat: 18 },
      { name: 'Outside requested range', date: offset(-8), meal: 'Lunch', calories: 999, protein: 99, carbs: 99, fat: 99 },
    ], water: [{ date: today, glasses: 6 }, { date: offset(-1), glasses: 4 }, { date: today, glasses: 7 }] });
    const result = await context.build(String(id), 'How many calories have I logged in the past 7 days?', true);
    const period = (result.sources.find(source => source.id === 'user-nutrition')!.data as any).period;
    expect(period).toMatchObject({ startDate: offset(-6), endDate: today, timezone, mealCount: 101, totals: { calories: 10450, protein: 1035, carbs: 2020, fat: 318 }, waterGlasses: 11 });
    expect(period.meals).toHaveLength(12);
    const service = new ChatService(context, { generate: async () => { throw new Error('Range arithmetic must not use generation'); } } as never);
    const ask = (text: string) => service.reply(String(id), [{ role: 'user', text }], true);
    expect((await ask('How many calories have I logged in the past 7 days?')).reply).toContain('10450 kcal');
    expect((await ask('How much water have I logged in the past 7 days?')).reply).toContain('11 glasses');
  });
  it('keeps semantic field selection owner-scoped and reloads changed saved values', async () => {
    const first = new Types.ObjectId(), second = new Types.ObjectId();
    await connection.db!.collection('profiles').insertMany([
      { userId: first, weight: '74', weightUnit: 'kg' }, { userId: second, weight: '999', weightUnit: 'kg' },
    ]);
    await connection.db!.collection('nutrition').insertMany([
      { userId: first, meals: [], water: [], dietaryPlan: { goal: 'Maintenance', calories: 2100, protein: 30, carbs: 40, fat: 30 } },
      { userId: second, meals: [], water: [], dietaryPlan: { goal: 'Maintenance', calories: 9999, protein: 30, carbs: 40, fat: 30 } },
    ]);
    const service = new ChatService(context, {
      routeQuestion: async () => ({ decision: 'answer', routeIds: ['nutrition.calorie-target', 'profile.weight'], timeframe: 'unspecified' }),
      generate: async () => { throw new Error('Saved values must not be generated'); },
    } as never);
    const ask = (userId: Types.ObjectId) => service.reply(String(userId), [{ role: 'user', text: 'Give me my energy allowance alongside my body mass.' }], true);
    const own = await ask(first), foreign = await ask(second);
    expect(own.reply).toContain('2100 kcal'); expect(own.reply).toContain('74 kg');
    expect(own.reply).not.toMatch(/9999|999 kg/);
    expect(foreign.reply).toContain('9999 kcal'); expect(foreign.reply).toContain('999 kg');
    expect(foreign.reply).not.toMatch(/2100|74 kg/);
    await connection.db!.collection('nutrition').updateOne({ userId: first }, { $set: { 'dietaryPlan.calories': 2200 } });
    expect((await ask(first)).reply).toContain('2200 kcal');
  });
});
