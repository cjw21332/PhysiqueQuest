import { ChatContextService } from '../chat-context.service.js';
import { ChatService } from '../chat.service.js';
import type { LocalChatProvider } from '../local-chat.provider.js';

export const CHAT_FIXTURE_OWNER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
export const CHAT_FIXTURE_PRIVATE = 'EXCLUDED-PRIVATE-SENTINEL';

/** Synthetic records only. Query adapters mimic Mongo seams; actual projections are checked in DB integration tests. */
export function createChatFixture(provider: Pick<LocalChatProvider, 'generate'>, scenario: 'populated' | 'empty' | 'partial' = 'populated') {
  const now = new Date(), day = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const owner = CHAT_FIXTURE_OWNER, privateText = CHAT_FIXTURE_PRIVATE;
  const owned = (data: Record<string, unknown>) => ({ userId: owner, ...data });
  const meals = [
    { name: 'Oatmeal', meal: 'Breakfast', date: day, calories: 300, protein: 15, carbs: 45, fat: 8 },
    { name: 'Rice bowl', meal: 'Lunch', date: day, calories: 500, protein: 25, carbs: 70, fat: 12 },
    { name: 'Salmon dinner', meal: 'Dinner', date: day, calories: 600, protein: 40, carbs: 50, fat: 22 },
    { name: 'Yogurt', meal: 'Snack', date: day, calories: 100, protein: 10, carbs: 12, fat: 2 },
    { name: 'Chicken salad', meal: 'Lunch', date: yesterday, calories: 450, protein: 35, carbs: 20, fat: 18 },
  ];
  const exercises = [{ exerciseId: 'squat-fixture', name: 'Squat', equipment: 'Dumbbells', prescription: '3 × 8', instructions: ['Keep your movement controlled.', 'Follow the exercise instructions.'], formTip: 'Keep your movement controlled.' }];
  const sets = [{ exerciseId: 'squat-fixture', status: 'completed', reps: 8, loadKg: 20 }];
  const data: Record<string, Record<string, any>[]> = scenario === 'empty' ? {} : {
    profiles: [owned({ name: 'Synthetic User', age: '28', gender: 'Female', goal: 'Build muscle', weight: '72', weightUnit: 'kg', targetWeight: '68', targetDate: '2027-03-01', height: '175', heightUnit: 'cm', waist: '82', waistUnit: 'cm', chest: '96', chestUnit: 'cm', arms: '32', armsUnit: 'cm', equipment: ['Dumbbells'], days: ['Monday', 'Wednesday', 'Friday'], duration: '45 min', conditions: ['Asthma'], healthNotes: 'Keep inhaler available during outdoor training.', contactName: 'Emergency Person', contactPhone: '+1 555 0100', contactRelationship: 'Sibling' })],
    nutrition: [owned({ dietaryPlan: scenario === 'partial' ? { goal: 'Maintenance', calories: 2200 } : { goal: 'Maintenance', calories: 2000, protein: 30, carbs: 40, fat: 30, activity: 'Moderate', startedAt: '2026-10-01T00:00:00Z' }, meals, water: [{ date: day, glasses: 6 }, { date: yesterday, glasses: 4 }] })],
    workouts: [
      owned({ status: 'active', startedAt: new Date(now.getTime() - 3600000), pausedAt: new Date(now.getTime() - 300000), origin: 'planned', exercises, sets, sourceRecordingId: privateText }),
      owned({ status: 'completed', startedAt: new Date(now.getTime() - 7200000), endedAt: new Date(now.getTime() - 4800000), durationSeconds: 2400, origin: 'planned', exercises, sets }),
    ],
    activity: [owned({ state: { timezone: 'UTC' } })],
    programs: [owned({ createdAt: new Date(), plan: { goal: 'Build muscle', duration: '45 min', sessionCount: 3, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((name, index) => ({ name, title: index % 2 === 0 && index < 5 ? 'Strength day' : 'Recovery day', isWorkoutDay: index % 2 === 0 && index < 5, exercises: index % 2 === 0 && index < 5 ? exercises : [] })) } })],
    progress: [
      owned({ metric: 'weight', value: 71, unit: 'kg', measuredAt: new Date(now.getTime() - 1000) }),
      owned({ metric: 'waist', value: 81, unit: 'cm', measuredAt: new Date(now.getTime() - 2000) }),
      owned({ metric: 'benchPress', value: 50, unit: 'kg', measuredAt: new Date(now.getTime() - 3000) }),
    ],
    settings: [owned({ values: { inactivity: true, threshold: 45, alarmVolume: false, showLeaderboard: false, notifications: true, nutritionTargets: { calories: 2100, protein: 140, carbs: 240, fats: 70 } } })],
    notifications: [owned({ items: [{ title: 'Workout saved', icon: 'dumbbell', unread: true, body: privateText, createdAt: now }, { title: 'Daily reminder', icon: 'bell', unread: true, body: privateText, createdAt: now }], reminder: { enabled: true, hour: 9, minute: 5, timezone: 'Asia/Singapore' } })],
    safety: [owned({ eventType: 'inactivity', status: 'delivered', occurredAt: new Date(now.getTime() - 3600000), location: privateText, providerReference: privateText })],
  };
  const calls: { name: string; owner: string }[] = [];
  const models = ['profiles', 'nutrition', 'workouts', 'activity', 'programs', 'progress', 'settings', 'notifications', 'safety'].map(name => {
    const select = (filter: Record<string, any>) => {
      calls.push({ name, owner: String(filter.userId) });
      return (data[name] ?? []).filter(row => String(row.userId) === String(filter.userId) && (!filter.metric || row.metric === filter.metric));
    };
    return { collection: {
      findOne: async (filter: Record<string, any>, options?: Record<string, any>) => {
        const record = select(filter)[0]; if (!record) return null;
        const result = { ...record };
        if (name === 'notifications') result.unreadCount = record.items.filter((item: any) => item.unread).length;
        if (name === 'nutrition') for (const field of ['chatToday', 'chatSelectedDay', 'chatPeriod']) {
          const condition = options?.projection?.[field]?.$let?.vars?.dayMeals?.$filter?.cond;
          const date = condition?.$eq?.[1] ?? condition?.$and?.[0]?.$gte?.[1];
          const end = condition?.$and?.[1]?.$lte?.[1];
          if (date) {
            const entries = record.meals.filter((meal: any) => end ? meal.date >= date && meal.date <= end : meal.date === date);
            const waterEntries = new Map(record.water.filter((entry: any) => end ? entry.date >= date && entry.date <= end : entry.date === date).map((entry: any) => [entry.date, entry.glasses]));
            result[field] = { mealCount: entries.length, totals: Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map(metric => [metric, entries.every((meal: any) => typeof meal[metric] === 'number') ? entries.reduce((sum: number, meal: any) => sum + meal[metric], 0) : null])), meals: entries.slice(0, 12), waterGlasses: [...waterEntries.values()].reduce<number>((total, value) => total + Number(value), 0) };
          }
        }
        return result;
      },
      find: (filter: Record<string, any>) => {
        let records = select(filter);
        const cursor = { sort: (sort: Record<string, number>) => { const [key, direction] = Object.entries(sort)[0]; records = [...records].sort((a,b) => (Number(new Date(a[key] ?? 0)) - Number(new Date(b[key] ?? 0))) * direction); return cursor; }, limit: (limit: number) => { records = records.slice(0, limit); return cursor; }, toArray: async () => records };
        return cursor;
      },
    } };
  });
  const activity = { getForAssistant: async () => ({
    state: { timezone: 'UTC', level: scenario === 'empty' ? 1 : 7, currentExp: scenario === 'empty' ? 0 : 40, nextLevelExp: 100, dayStreak: scenario === 'empty' ? 0 : 3, earnedPoints: scenario === 'empty' ? 0 : 160, questProgress: { workout: 1, meals: 3, water: 6 } },
    dailyMissions: [{ key: 'workout', title: 'Complete one workout', target: 1, progress: 1, points: 100, complete: true }, { key: 'meals', title: 'Log 3 meals', target: 3, progress: 3, points: 60, complete: true }, { key: 'water', title: 'Drink 8 glasses of water', target: 8, progress: 6, points: 40, complete: false }],
    badges: [{ id: 'hydrated', title: 'Hydrated', earned: true }, { id: 'streak-10', title: '10-day streak', earned: false }],
  }) };
  const context = new ChatContextService(...models.slice(0,7) as [never,never,never,never,never,never,never], activity as never, models[7] as never, models[8] as never);
  return { service: new ChatService(context, provider as LocalChatProvider), context, data, calls };
}
