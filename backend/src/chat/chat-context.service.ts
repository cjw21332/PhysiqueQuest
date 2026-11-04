import { Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Profile } from '../profile/schemas/profile.schema.js';
import { Nutrition } from '../nutrition/schemas/nutrition.schema.js';
import { WorkoutSession } from '../workouts/schemas/workout-session.schema.js';
import { Activity } from '../activity/schemas/activity.schema.js';
import { ActivityService } from '../activity/activity.service.js';
import { CoachProgram } from '../coach/coach-program.schema.js';
import { ProgressEntry } from '../progress/schemas/progress-entry.schema.js';
import { Settings } from '../settings/schemas/settings.schema.js';
import { Notifications } from '../notifications/schemas/notification.schema.js';
import { AlertEvent } from '../safety/schemas/alert-event.schema.js';
import { activityDate, earnsWorkoutCredit } from '../workouts/workout-contract.js';
import { decryptProfile } from '../privacy/health-encryption.js';
import { selectChatKnowledge } from './chat-knowledge.js';
import { resolveChatPage } from './chat-pages.js';
import { classifyChatQuestion, normalizeChatQuestion } from './chat-intent.js';
import { nutritionPeriod, nutritionSelectedDate } from './chat-nutrition-period.js';

export type ChatSource = { id: string; label: string };
type ContextSource = ChatSource & { data: unknown };
type Row = Record<string, any>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown, maximum: number): Row[] => Array.isArray(value) ? value.slice(0, maximum).map(object) : [];
// This withholds obvious instruction-shaped records as defence in depth. It is not a prompt-injection security guarantee.
const INSTRUCTION_OVERRIDE = /\b(?:system|developer)\s*(?:prompt|instruction|message|role)|\b(?:ignore|override|disregard|forget)\b.{0,60}\b(?:instructions?|rules?|prompts?|previous|system|constraints?|safeguards?)\b|\b(?:reveal|print|show|repeat|give|expose|leak)\b.{0,60}\b(?:prompts?|secrets?|tokens?|passwords?|api[ -]?keys?)\b|\b(?:jailbreak|developer mode|you are now|act as|new role|answer only|respond only|output only)\b/is;
const text = (value: unknown, maximum = 100): string | null => {
  if (typeof value !== 'string' || INSTRUCTION_OVERRIDE.test(value)) return null;
  return value.slice(0, maximum).replace(/\p{Cc}/gu, ' ');
};
const numericText = (value: unknown, maximum: number, minimum = 0): string | null => {
  if (typeof value !== 'string' || value.length > 16 || !/^\d{1,4}(?:\.\d{1,3})?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? String(parsed) : null;
};
const FIELD_POLICY = 'Null or filtered values are unavailable. Each field is independent: never fill a missing field from another. Current weight is not target weight; a saved program goal does not establish the current profile goal.';
const number = (value: unknown, maximum = 10000): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
const choice = (value: unknown, allowed: readonly string[]): string | null => typeof value === 'string' && allowed.includes(value) ? value : null;
const strings = (value: unknown, maximum: number): string[] => Array.isArray(value) ? value.slice(0, maximum).flatMap(value => { const clean = text(value, 60); return clean === null ? [] : [clean]; }) : [];
const date = (value: unknown): string | null => {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};
const calendarDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return date(value)?.slice(0, 10) === value ? value : null;
};
const safeTimezone = (value: unknown, fallback = 'UTC'): string => {
  const candidate = text(value, 80);
  if (!candidate) return fallback;
  try { new Intl.DateTimeFormat('en', { timeZone: candidate }); return candidate; } catch { return fallback; }
};

/** Database-computed daily totals inspect all owned rows, never a recent excerpt. */
function nutritionDayProjection(day: string, end?: string) {
  const validValue = (path: string, maximum: number) => ({ $and: [{ $isNumber: path }, { $gte: [path, 0] }, { $lte: [path, maximum] }] });
  const total = (metric: string, maximum: number) => ({ $cond: [
    { $allElementsTrue: [{ $map: { input: '$$dayMeals', as: 'meal', in: validValue(`$$meal.${metric}`, maximum) } }] },
    { $sum: { $map: { input: '$$dayMeals', as: 'meal', in: `$$meal.${metric}` } } }, null,
  ] });
  return { $let: {
    vars: {
      dayMeals: { $filter: { input: { $ifNull: ['$meals', []] }, as: 'meal', cond: end ? { $and: [{ $gte: ['$$meal.date', day] }, { $lte: ['$$meal.date', end] }] } : { $eq: ['$$meal.date', day] } } },
      dayWater: { $filter: { input: { $ifNull: ['$water', []] }, as: 'water', cond: end ? { $and: [{ $gte: ['$$water.date', day] }, { $lte: ['$$water.date', end] }] } : { $eq: ['$$water.date', day] } } },
    },
    in: {
      mealCount: { $size: '$$dayMeals' },
      totals: { calories: total('calories', 10000), protein: total('protein', 2000), carbs: total('carbs', 2000), fat: total('fat', 2000) },
      meals: { $slice: ['$$dayMeals', 12] },
      waterGlasses: end ? { $let: {
        vars: { values: { $map: { input: { $setUnion: [{ $map: { input: '$$dayWater', as: 'entry', in: '$$entry.date' } }, []] }, as: 'date', in: { $let: {
          vars: { last: { $arrayElemAt: [{ $filter: { input: '$$dayWater', as: 'entry', cond: { $eq: ['$$entry.date', '$$date'] } } }, -1] } },
          in: { $cond: [validValue('$$last.glasses', 100), '$$last.glasses', null] },
        } } } } },
        in: { $cond: [{ $allElementsTrue: [{ $map: { input: '$$values', as: 'value', in: { $ne: ['$$value', null] } } }] }, { $sum: '$$values' }, null] },
      } } : { $cond: [
        { $eq: [{ $size: '$$dayWater' }, 0] }, 0,
        { $let: { vars: { water: { $arrayElemAt: ['$$dayWater', -1] } }, in: { $cond: [validValue('$$water.glasses', 100), '$$water.glasses', null] } } },
      ] },
    },
  } };
}

/** No model-generated queries, unscoped collection reads, writes, or shared user context. */
@Injectable()
export class ChatContextService {
  constructor(
    @InjectModel(Profile.name) private readonly profiles: Model<Profile>,
    @InjectModel(Nutrition.name) private readonly nutrition: Model<Nutrition>,
    @InjectModel(WorkoutSession.name) private readonly workouts: Model<WorkoutSession>,
    @InjectModel(Activity.name) private readonly activity: Model<Activity>,
    @InjectModel(CoachProgram.name) private readonly programs: Model<CoachProgram>,
    @InjectModel(ProgressEntry.name) private readonly progress: Model<ProgressEntry>,
    @InjectModel(Settings.name) private readonly settings: Model<Settings>,
    private readonly activitySummary: ActivityService,
    @Optional() @InjectModel(Notifications.name) private readonly notifications?: Model<Notifications>,
    @Optional() @InjectModel(AlertEvent.name) private readonly safetyEvents?: Model<AlertEvent>,
  ) {}

  async build(userId: string, question: string, includePersonalData: boolean, page?: string): Promise<{ sources: ContextSource[]; personalDataIncluded: boolean }> {
    // Validate identity even in guidance mode, but guidance mode performs no personal reads.
    if (!Types.ObjectId.isValid(userId)) throw new UnauthorizedException();
    const intent = classifyChatQuestion(question, page);
    const normalized = normalizeChatQuestion(question);
    const sources: ContextSource[] = selectChatKnowledge(normalized, page);
    if (!includePersonalData) return { sources, personalDataIncluded: false };

    // Consent permits selected records, but guidance and capability questions need no account context.
    if (intent.guide || !intent.personal) return { sources, personalDataIncluded: false };

    const owner = { userId: new Types.ObjectId(userId) };
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 86400_000);
    const since = cutoff.toISOString().slice(0, 10);
    const currentPage = resolveChatPage(page);
    const topic = normalized + (currentPage && /\b(?:this (?:page|screen|section)|here)\b/i.test(normalized) ? ` ${currentPage.section} ${currentPage.title}` : '');
    const scan = intent.topics.includes('nutrition');
    const coach = intent.topics.includes('coach');
    const instructionsRequested = /instructions?|form (?:cue|tip)|how (?:do|to|can).*(?:perform|squat|deadlift|push.?up|lunge|plank|press|row)/i.test(topic);
    const quests = intent.topics.includes('quests');
    const profile = intent.topics.includes('profile');
    const notices = intent.topics.includes('notifications');
    const safety = intent.topics.includes('safety');
    const preferences = intent.topics.includes('settings');
    const overview = intent.topics.includes('overview');
    const identityNameRequested = /\b(?:my name|name did i save|name in my profile|who am i)\b/i.test(topic);
    const identityAgeRequested = /\b(?:my age|age did i save|how old am i)\b/i.test(topic);
    const identityGenderRequested = /\b(?:my gender|gender did i save|my sex|sex did i save)\b/i.test(topic);
    const healthNotesRequested = /\bhealth notes?\b/i.test(topic);
    const healthConditionsRequested = /\b(?:health|conditions?|injur(?:y|ies)|medical)\b/i.test(topic) && !healthNotesRequested ||
      /\b(?:health profile|health conditions?|medical conditions?)\b/i.test(topic);
    const healthRequested = healthConditionsRequested || healthNotesRequested;
    const contactNameRequested = /\b(?:contact name|contact's name|name (?:of|for) (?:my )?emergency contact|emergency contact(?:'s)? name)\b/i.test(topic);
    const contactPhoneRequested = /\b(?:contact(?:'s)? (?:phone|number)|emergency contact(?:'s)? (?:phone|number)|(?:phone|number) (?:for|of) (?:my )?emergency contact)\b/i.test(topic);
    const contactRelationshipRequested = /\b(?:contact relationship|contact's relationship|relationship (?:of|to) (?:my )?emergency contact|emergency contact(?:'s)? relationship)\b/i.test(topic);
    const contactAllPhrase = /\b(?:(?:who|what) is (?:my )?emergency contact|tell me about (?:my )?emergency contact|emergency contact (?:details|information|info)|safety contact(?: details| information| info)?|contact details|contact information)\b/i.test(topic);
    const contactAllRequested = contactAllPhrase && !contactNameRequested && !contactPhoneRequested && !contactRelationshipRequested;
    const contactRequested = contactAllRequested || contactNameRequested || contactPhoneRequested || contactRelationshipRequested;
    const progressRequested = overview || profile && /\b(?:progress|check.?in|latest|recent|trend|history)\b/i.test(topic);
    const settingsRequested = preferences || overview || scan && /\b(?:settings?|compare|difference|versus|independent)\b/i.test(topic);
    const safetyEventsRequested = safety && /\b(?:(?:safety|emergency|inactivity)? alert|inactivity event|alert status|delivery status|event|incident|delivered|cancelled|canceled)\b/i.test(topic);
    const needNutrition = scan || quests || overview;
    const needWorkouts = coach || quests || overview;
    const needProfile = profile || coach || overview;
    const needSettings = scan || preferences || overview || safetyEventsRequested || settingsRequested;
    const namedMetrics = [ /\bweight\b/i.test(topic) ? 'weight' : '', /\bwaist\b/i.test(topic) ? 'waist' : '', /\bbench(?:.?press)?\b/i.test(topic) ? 'benchPress' : '' ].filter(Boolean);
    const requestedMetrics = namedMetrics.length ? namedMetrics : ['weight', 'waist', 'benchPress'];

    try {
      const needsActivityDate = needNutrition || quests || overview;
      const activityRecord = needsActivityDate ? await this.activity.collection.findOne(owner, { projection: { _id: 0, 'state.timezone': 1 }, maxTimeMS: 3000 }) : null;
      const timezone = safeTimezone(object(object(activityRecord).state).timezone);
      const today = activityDate(now, timezone);
      const selectedDate = nutritionSelectedDate(normalized, today);
      const period = scan ? nutritionPeriod(normalized, today) : undefined;
      const [profileRecord, nutritionRecord, workoutRecords, programRecord, progressRecords, settingsRecord, questSummary, notificationRecord, safetyRecords] = await Promise.all([
        needProfile ? this.profiles.collection.findOne(owner, { projection: {
          _id: 0, goal: 1, targetWeight: 1, targetDate: 1, height: 1, heightInches: 1, heightUnit: 1,
          weight: 1, weightUnit: 1, chest: 1, chestUnit: 1, waist: 1, waistUnit: 1, arms: 1, armsUnit: 1,
          measurementUnit: 1, activity: 1, equipment: 1, days: 1, duration: 1,
          ...(identityNameRequested ? { name: 1 } : {}),
          ...(identityAgeRequested ? { age: 1 } : {}),
          ...(identityGenderRequested ? { gender: 1 } : {}),
          ...(healthConditionsRequested ? { conditions: 1 } : {}),
          ...(healthNotesRequested ? { healthNotes: 1 } : {}),
          ...(contactAllRequested || contactNameRequested ? { contactName: 1 } : {}),
          ...(contactAllRequested || contactPhoneRequested ? { contactPhone: 1 } : {}),
          ...(contactAllRequested || contactRelationshipRequested ? { contactRelationship: 1 } : {}),
        }, maxTimeMS: 3000 }) : null,
        needNutrition ? this.nutrition.collection.findOne(owner, { projection: { _id: 0, meals: { $slice: -90 }, water: { $slice: -45 }, dietaryPlan: 1, chatToday: nutritionDayProjection(today), chatSelectedDay: nutritionDayProjection(selectedDate), ...(period ? { chatPeriod: nutritionDayProjection(period.start, period.end) } : {}) }, maxTimeMS: 3000 }) : null,
        needWorkouts ? this.workouts.collection.find({ ...owner, $or: [{ status: 'active' }, { status: 'completed', endedAt: { $gte: cutoff, $lte: now } }] }, { projection: { _id: 0, startedAt: 1, endedAt: 1, pausedAt: 1, pausedSeconds: 1, durationSeconds: 1, status: 1, origin: 1, activityDate: 1, scheduledDate: 1, dayIndex: 1, timezone: 1, exercises: { $slice: 12 }, sets: { $slice: 80 }, exerciseResults: { $slice: 12 } } }).sort({ startedAt: -1 }).limit(12).toArray() : [],
        coach || overview ? this.programs.collection.findOne(owner, { projection: { _id: 0, plan: 1, createdAt: 1 }, sort: { createdAt: -1 } }) : null,
        progressRequested ? Promise.all(requestedMetrics.map(metric => this.progress.collection.find({ ...owner, metric, measuredAt: { $lte: now } }, { projection: { _id: 0, metric: 1, value: 1, unit: 1, measuredAt: 1 } }).sort({ measuredAt: -1 }).limit(9).toArray())).then(groups => groups.flat().sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())) : [],
        needSettings ? this.settings.collection.findOne(owner, { projection: { _id: 0, 'values.nutritionTargets': 1, 'values.showLeaderboard': 1, 'values.inactivity': 1, 'values.alarmVolume': 1, 'values.threshold': 1, 'values.notifications': 1 } }) : null,
        quests || overview ? this.activitySummary.getForAssistant(userId) : null,
        notices && this.notifications ? this.notifications.collection.findOne(owner, { projection: { _id: 0, items: { $slice: -12 }, reminder: 1, unreadCount: { $size: { $filter: { input: { $ifNull: ['$items', []] }, as: 'item', cond: { $eq: ['$$item.unread', true] } } } } } }) : null,
        safetyEventsRequested && this.safetyEvents ? this.safetyEvents.collection.find(owner, { projection: { _id: 0, eventType: 1, status: 1, occurredAt: 1, resolvedAt: 1 } }).sort({ occurredAt: -1 }).limit(6).toArray() : [],
      ]);

      if (needProfile) {
        const p = profileRecord ? object(decryptProfile({ ...object(profileRecord), userId: owner.userId })) : {};
        sources.push({ id: 'user-profile', label: 'Your saved goals and preferences', data: profileRecord ? {
          goal: text(p.goal), targetWeight: numericText(p.targetWeight, 1000, 0.1), targetDate: calendarDate(p.targetDate),
          height: numericText(p.height, 300, 0.1), heightInches: numericText(p.heightInches, 12), heightUnit: choice(p.heightUnit, ['cm', 'ft & in.']),
          weight: numericText(p.weight, 1000, 0.1), weightUnit: choice(p.weightUnit, ['kg', 'lbs']), activity: text(p.activity, 60),
          chest: numericText(p.chest, 1000), chestUnit: choice(p.chestUnit ?? p.measurementUnit, ['cm', 'inch']),
          waist: numericText(p.waist, 1000), waistUnit: choice(p.waistUnit ?? p.measurementUnit, ['cm', 'inch']),
          arms: numericText(p.arms, 1000), armsUnit: choice(p.armsUnit ?? p.measurementUnit, ['cm', 'inch']),
          equipment: strings(p.equipment, 12), days: strings(p.days, 7), duration: text(p.duration, 30),
        } : { status: 'missing', note: 'No saved profile was found.' } });
        const privateProfile: Record<string, unknown> = {};
        privateProfile.profileStatus = profileRecord ? 'available' : 'missing';
        if (identityNameRequested) privateProfile.name = text(p.name, 100);
        if (identityAgeRequested) privateProfile.age = numericText(p.age, 120, 1);
        if (identityGenderRequested) privateProfile.gender = text(p.gender, 40);
        if (healthRequested) {
          if (healthConditionsRequested) privateProfile.conditions = strings(p.conditions, 30);
          if (healthNotesRequested) privateProfile.healthNotes = text(p.healthNotes, 500);
        }
        if (contactRequested) {
          if (contactAllRequested || contactNameRequested) privateProfile.contactName = text(p.contactName, 100);
          if (contactAllRequested || contactPhoneRequested) privateProfile.contactPhone = text(p.contactPhone, 30);
          if (contactAllRequested || contactRelationshipRequested) privateProfile.contactRelationship = text(p.contactRelationship, 30);
        }
        if (Object.keys(privateProfile).length > 1) sources.push({
          id: 'user-private-profile',
          label: 'Your requested private profile fields',
          data: privateProfile,
        });
      }

      const n = object(nutritionRecord);
      // Calendar logs may use any activity timezone, including tomorrow relative to UTC.
      const latestCalendarDay = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10);
      const meals = rows(n.meals, 90).filter(meal => { const d = calendarDate(meal.date); return d !== null && d >= since && d <= latestCalendarDay; });
      const water = rows(n.water, 45).filter(entry => { const d = calendarDate(entry.date); return d !== null && d >= since && d <= latestCalendarDay; });
      if (needNutrition) {
        const dietary = object(n.dietaryPlan);
        const mapMeal = (m: Row) => ({ name: text(m.name, 90), date: calendarDate(m.date), meal: text(m.meal, 24), calories: number(m.calories), protein: number(m.protein, 2000), carbs: number(m.carbs, 2000), fat: number(m.fat, 2000) });
        const mapDay = (value: unknown, day: string) => {
          const summary = object(value), totals = object(summary.totals);
          return {
            date: day, timezone, status: value ? 'available' : nutritionRecord ? 'unavailable' : 'missing',
            note: 'Counts and totals are computed from all saved entries for this date. The listed foods are at most 12 entries; missing/invalid nutrient values make that total unknown. No logs does not mean no actual intake.',
            mealCount: number(summary.mealCount, Number.MAX_SAFE_INTEGER),
            totals: { calories: number(totals.calories, Number.MAX_SAFE_INTEGER), protein: number(totals.protein, Number.MAX_SAFE_INTEGER), carbs: number(totals.carbs, Number.MAX_SAFE_INTEGER), fat: number(totals.fat, Number.MAX_SAFE_INTEGER) },
            waterGlasses: number(summary.waterGlasses, day.includes(' through ') ? 36600 : 100), meals: rows(summary.meals, 12).map(mapMeal),
          };
        };
        const calories = number(dietary.calories), protein = number(dietary.protein, 100), carbs = number(dietary.carbs, 100), fat = number(dietary.fat, 100);
        const balancedMacros = protein !== null && carbs !== null && fat !== null && Math.abs(protein + carbs + fat - 100) < 0.001;
        sources.push({ id: 'user-nutrition', label: 'Your recent saved nutrition', data: nutritionRecord ? {
          since, note: 'At most 90 last-inserted meals and 45 water entries were inspected; only recent entries are shown. Older or truncated records are unknown. Nutrition values may be estimates.',
          meals: meals.slice(-20).map(mapMeal),
          water: water.slice(-14).map(w => ({ date: calendarDate(w.date), glasses: number(w.glasses, 100) })),
          today: mapDay(n.chatToday, today), selectedDay: mapDay(n.chatSelectedDay, selectedDate),
          ...(period ? { period: { ...mapDay(n.chatPeriod, period.start + ' through ' + period.end), startDate: period.start, endDate: period.end, note: 'Totals inspect all owned saved entries in this inclusive calendar range, not the recent excerpt. Weeks start Monday. This is logged intake, not verified actual intake; current targets do not establish historical targets.' } } : {}),
          dietaryPlan: n.dietaryPlan ? {
            goal: text(dietary.goal, 60), calories, protein, carbs, fat, macroUnit: 'percentage', macrosBalanced: balancedMacros,
            activity: choice(dietary.activity, ['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete']), startedAt: date(dietary.startedAt),
            macroTargetsGrams: calories !== null && balancedMacros ? { protein: Math.round(calories * protein! / 400), carbs: Math.round(calories * carbs! / 400), fat: Math.round(calories * fat! / 900) } : null,
            mealSchedule: 'The app offers suggested meal timing/allocation; it does not save a personalized meal schedule in this plan.',
          } : null,
        } : { status: 'missing', note: 'No saved nutrition record was found; intake is unknown.', dietaryPlan: null, today: mapDay(null, today), selectedDay: mapDay(null, selectedDate) } });
      }

      const workouts = rows(workoutRecords, 12).filter(workout => workout.status === 'completed');
      const activeWorkout = rows(workoutRecords, 12).find(workout => workout.status === 'active');
      const mapWorkout = (w: Row) => {
        const exercises = rows(w.exercises, 12);
        const sets = rows(w.sets, 80);
        const exerciseName = (id: unknown): string | null => text(exercises.find(e => e.exerciseId === id)?.name, 70);
        return {
          status: choice(w.status, ['active', 'completed']), startedAt: date(w.startedAt), endedAt: date(w.endedAt),
          pausedAt: date(w.pausedAt), pausedSeconds: number(w.pausedSeconds, 365 * 86400),
          durationSeconds: number(w.durationSeconds, 86400), origin: choice(w.origin, ['planned', 'standalone', 'recorded-set']),
          scheduledDate: calendarDate(w.scheduledDate), dayIndex: number(w.dayIndex, 6),
          exercises: exercises.slice(0, 4).map(e => ({ name: text(e.name, 70), equipment: text(e.equipment, 45), prescription: text(e.prescription, 40) })),
          completedSets: sets.filter(s => s.status === 'completed').slice(0, 12).map(s => ({ exercise: exerciseName(s.exerciseId), reps: number(s.reps, 1000), loadKg: number(s.loadKg, 1000), durationSeconds: number(s.durationSeconds, 86400) })),
          skippedSetsInExcerpt: sets.filter(s => s.status === 'skipped').length,
          legacyResults: rows(w.exerciseResults, 4).map(result => ({
            exercise: exerciseName(result.exerciseId) ?? (typeof result.exerciseId === 'string' && !/^[a-f\d]{24}$/i.test(result.exerciseId) ? text(result.exerciseId.replace(/[-_]+/g, ' '), 70) : null),
            reps: number(result.reps, 1000), loadKg: number(result.loadKg, 1000),
          })),
        };
      };
      if (needWorkouts) sources.push({ id: 'user-workouts', label: 'Your recent completed workouts', data: {
        since: cutoff.toISOString(), status: workouts.length ? 'available' : 'missing', truncated: workouts.length > 10,
        note: 'Inspected up to12 active/recent completed sessions; completed excerpts are within30days. Up to10 completed sessions,4 exercise names,12 completed sets and4 legacy results are shown. Counts from excerpts are lower bounds, not all-time personal records. Active workout data is server-saved; device drafts/timers are unavailable.',
        activeWorkout: activeWorkout ? mapWorkout(activeWorkout) : null,
        sessions: workouts.slice(0, 10).map(mapWorkout),
      } });

      if (quests || overview) {
        const timezone = safeTimezone(object(object(activityRecord).state).timezone);
        const today = activityDate(now, timezone);
        const todayMeals = meals.filter(meal => meal.date === today).length;
        const todayWater = water.find(w => w.date === today);
        const completedToday = workouts.filter(w => earnsWorkoutCredit(w) && (calendarDate(w.activityDate) ?? activityDate(w.endedAt, safeTimezone(w.timezone, timezone))) === today).length;
        const summary = object(questSummary), state = object(summary.state), progress = object(state.questProgress);
        const level = number(state.level, Number.MAX_SAFE_INTEGER), currentExp = number(state.currentExp, 99), nextLevelExp = number(state.nextLevelExp, 100);
        const totalExperience = level !== null && Number.isSafeInteger(level) && level >= 1 && currentExp !== null && nextLevelExp !== null && nextLevelExp > 0
          ? number((level - 1) * nextLevelExp + currentExp, Number.MAX_SAFE_INTEGER) : null;
        sources.push({ id: 'user-activity', label: 'Your Quests summary', data: {
          date: today, timezone, note: 'State, daily missions and badges use the application rules and all saved own activity. currentExp is XP already earned within this level, not XP remaining. experienceToNextLevel is XP still needed. totalExperience is all-time quest XP. The app caps current streaks at 365 days. observed-prefixed counts use only the bounded excerpts above and are lower bounds. Leaderboard standings and the Top 10 badge are unavailable to chat.',
          state: {
            timezone: safeTimezone(state.timezone), level, currentExp, nextLevelExp, totalExperience,
            experienceToNextLevel: nextLevelExp !== null && currentExp !== null ? Math.max(0, nextLevelExp - currentExp) : null,
            dayStreak: number(state.dayStreak, 365), earnedPoints: number(state.earnedPoints, 1000),
            questProgress: { workout: number(progress.workout, 1), meals: number(progress.meals, 3), water: number(progress.water, 8) },
          },
          dailyMissions: rows(summary.dailyMissions, 4).map(mission => ({ key: choice(mission.key, ['workout', 'meals', 'water', 'personal-record']), title: text(mission.title, 80), target: number(mission.target, 100), points: number(mission.points, 1000), progress: number(mission.progress, 100), complete: typeof mission.complete === 'boolean' ? mission.complete : null })),
          badges: rows(summary.badges, 8).filter(badge => badge.id !== 'top-10').map(badge => ({ id: choice(badge.id, ['streak-10', 'first-pr', 'perfect-form', 'hydrated', 'macro-master', 'streak-30', 'early-bird']), title: text(badge.title, 80), earned: typeof badge.earned === 'boolean' ? badge.earned : null, available: typeof badge.available === 'boolean' ? badge.available : true, description: text(badge.description, 180) })),
          leaderboard: { status: 'unavailable', top10Badge: 'unavailable', reason: 'The assistant does not read other accounts or leaderboard standings.' },
          observedMealsToday: todayMeals, observedWaterGlassesToday: number(todayWater?.glasses, 100), observedCreditableWorkoutsToday: completedToday,
          missionThresholds: { meals: 3, waterGlasses: 8, workouts: 1 },
        } });
      }

      if (coach || overview) {
        const plan = object(object(programRecord).plan);
        sources.push({ id: 'user-program', label: 'Your saved Coach program snapshot', data: programRecord ? {
          savedAt: date(object(programRecord).createdAt), note: 'Saved snapshot only; may be older than current profile preferences. No program is generated or changed by chat.',
          goal: text(plan.goal), duration: text(plan.duration, 30), sessionCount: number(plan.sessionCount, 7), sets: text(plan.sets, 30),
          days: rows(plan.days, 7).map(day => ({ name: text(day.name, 15), title: text(day.title, 80), isWorkoutDay: typeof day.isWorkoutDay === 'boolean' ? day.isWorkoutDay : null,
            exercises: rows(day.exercises, 4).map(e => ({ name: text(e.name, 70), equipment: text(e.equipment, 45), prescription: text(e.prescription, 40),
              ...(instructionsRequested ? { formTip: text(e.formTip, 180), instructions: Array.isArray(e.instructions) ? e.instructions.slice(0, 5).map((instruction: unknown) => text(instruction, 180)).filter(Boolean) : [] } : {}),
            })),
          })),
        } : { status: 'missing', note: 'No saved Coach program snapshot was found. Open Coach to load your current program.' } });
      }

      if (progressRequested) {
        const measurements = rows(progressRecords, 27).map(p => ({ metric: choice(p.metric, ['weight', 'waist', 'benchPress']), value: number(p.value, 1000), unit: choice(p.unit, ['kg', 'lb', 'cm', 'in']), measuredAt: date(p.measuredAt) }));
        sources.push({ id: 'user-progress', label: 'Your recent saved measurements', data: {
          status: progressRecords.length ? 'available' : 'missing', note: 'Up to9 newest saved values per requested metric; not complete measurement history. Profile weight and newer weight check-ins are separate saved fields.',
          latestByMetric: Object.fromEntries(requestedMetrics.map(metric => [metric, measurements.find(item => item.metric === metric) ?? null])),
          measurements,
        } });
      }

      if (needSettings) {
        const values = object(object(settingsRecord).values), targets = object(values.nutritionTargets);
        sources.push({ id: 'user-settings', label: 'Your saved nutrition and visibility settings', data: settingsRecord ? {
          showLeaderboard: typeof values.showLeaderboard === 'boolean' ? values.showLeaderboard : null,
          inactivity: typeof values.inactivity === 'boolean' ? values.inactivity : null,
          alarmVolume: typeof values.alarmVolume === 'boolean' ? values.alarmVolume : null,
          threshold: typeof values.threshold === 'number' && [30, 45, 60].includes(values.threshold) ? values.threshold : null,
          notifications: typeof values.notifications === 'boolean' ? values.notifications : null,
          nutritionTargets: values.nutritionTargets ? { calories: number(targets.calories), protein: number(targets.protein, 1000), carbs: number(targets.carbs, 2000), fats: number(targets.fats, 1000), macroUnit: 'grams' } : null,
        } : { status: 'missing', note: 'No saved settings record was found.' } });
      }
      if (notices) {
        const notice = object(notificationRecord), reminder = object(notice.reminder);
        sources.push({ id: 'user-notifications', label: 'Your saved notification summary', data: notificationRecord ? {
          status: 'available', note: 'Latest12 notification titles and safe metadata only; bodies, IDs, device/push tokens and delivery payloads are excluded. unreadCount counts all saved unread notices; listed items are an excerpt.',
          unreadCount: number(notice.unreadCount, Number.MAX_SAFE_INTEGER),
          items: rows(notice.items, 12).map(item => ({ title: text(item.title, 100), category: choice(item.icon, ['shield', 'trophy', 'dumbbell', 'meal', 'water', 'fire', 'bell', 'target', 'check']), unread: typeof item.unread === 'boolean' ? item.unread : null, createdAt: date(item.createdAt) })),
          reminder: notice.reminder ? { enabled: typeof reminder.enabled === 'boolean' ? reminder.enabled : null, hour: number(reminder.hour, 23), minute: number(reminder.minute, 59), timezone: text(reminder.timezone, 80) } : null,
        } : { status: this.notifications ? 'missing' : 'unavailable', note: 'Saved notifications are not available for this request.' } });
      }
      if (safetyEventsRequested) sources.push({ id: 'user-safety', label: 'Your alert delivery status summary', data: {
        status: this.safetyEvents ? (safetyRecords.length ? 'available' : 'missing') : 'unavailable',
        note: 'Latest6 own event status/times only. No locations, contact values, messages, provider references, workout IDs or delivery guarantees. Missing records do not prove no past alerts.',
        events: rows(safetyRecords, 6).map(event => ({ eventType: choice(event.eventType, ['manual', 'inactivity', 'cancelled']), status: choice(event.status, ['pending', 'delivered', 'failed', 'cancelled']), occurredAt: date(event.occurredAt), resolvedAt: date(event.resolvedAt) })),
      } });
      const result = sources.map(source => source.id.startsWith('user-') ? { ...source, data: { ...object(source.data), fieldPolicy: FIELD_POLICY } } : source);
      // Keep model prefill bounded without sharing/caching personal results between requests.
      for (let attempt = 0; JSON.stringify(result).length > 18000 && attempt < 30; attempt++) {
        const candidates = result.filter(source => source.id.startsWith('user-') && source.id !== 'user-activity').flatMap(source =>
          Object.entries(object(source.data)).filter(([, value]) => Array.isArray(value) && value.length > 1).map(([key, value]) => ({ source, key, value: value as unknown[], size: JSON.stringify(value).length })),
        ).sort((a, b) => b.size - a.size);
        const candidate = candidates[0];
        if (!candidate) break;
        object(candidate.source.data)[candidate.key] = candidate.value.slice(0, Math.max(1, Math.floor(candidate.value.length / 2)));
        object(candidate.source.data).contextTrimmed = true;
      }
      return { sources: result, personalDataIncluded: true };
    } catch {
      // Never let an unavailable database masquerade as an empty account, or leak driver details.
      throw new ServiceUnavailableException('Your saved data could not be loaded. Try again or turn off personal data.');
    }
  }
}
