import { resolveChatPage, selectChatPages } from './chat-pages.js';
import { classifyChatQuestion } from './chat-intent.js';
import type { ChatSource } from './chat-context.service.js';
import { nutritionRecordAnswer } from './chat-nutrition-answers.js';

type Source = ChatSource & { data: unknown };
type Row = Record<string, unknown>;
export type FastAnswer = { reply: string; sourceIds: string[] };
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
const present = (value: unknown): value is string | number => (typeof value === 'string' && value.trim().length > 0) || (typeof value === 'number' && Number.isFinite(value));
const display = (value: unknown) => present(value) ? String(value) : 'unavailable';
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const quantity = (value: unknown, suffix: unknown) => present(value) ? String(value) + (typeof suffix === 'string' && suffix ? ' ' + (suffix === 'inch' ? 'in' : suffix) : ' (unit unavailable)') : 'unavailable';
const list = (value: unknown) => Array.isArray(value) && value.length ? value.filter(item => typeof item === 'string').join(', ') : 'unavailable';
const enabled = (value: unknown) => typeof value === 'boolean' ? value ? 'on' : 'off' : 'unavailable';

export function isPageHelpQuestion(question: string) { return classifyChatQuestion(question).guide; }

/** Reviewed procedures do not require a model or any account data. */
export function fastPageAnswer(question: string, page?: string): FastAnswer | undefined {
  const intent = classifyChatQuestion(question, page);
  if (!intent.guide) return undefined;
  const pages = selectChatPages(intent.normalized, page, 2);
  // A known page is a fallback for a guide request, never for arbitrary questions.
  const contextual = /\b(?:this (?:page|screen|section)|here|these controls|this feature)\b/.test(intent.normalized);
  const selected = pages[0] ?? (contextual || intent.topics.length ? resolveChatPage(page) : undefined);
  if (!selected) return undefined;
  const steps = selected.steps.slice(0, 4);
  return {
    reply: selected.title + ': ' + selected.summary + (steps.length ? '\n\n' + steps.map((step, index) => (index + 1) + '. ' + step).join('\n') : '') + '\n\nOpen ' + selected.path + ' in PhysiqueQuest.',
    sourceIds: ['page-' + selected.id],
  };
}

/** Short reviewed explanations avoid model latency for common in-app learning questions. */
export function fastEducationAnswer(question: string): FastAnswer | undefined {
  const intent = classifyChatQuestion(question);
  if (intent.personal || !intent.guide || /\b(?:i|my|mine)\b/.test(intent.normalized)) return undefined;
  const q = intent.normalized;
  const sourceIds = ['system-education'];
  if (/\b(?:macro grams?|grams? (?:for|from|in) (?:my )?macros?|calculate.*grams?|grams?.*(?:percentage|calorie)|percentage.*grams?)\b/.test(q)) {
    return {
      reply: 'Scan turns a calorie target and macro percentages into approximate grams per day: protein and carbs use calories × percentage ÷ 400; fat uses calories × percentage ÷ 900. The app rounds to whole grams, and the percentages should total 100%. These are planning targets, not logged intake.',
      sourceIds,
    };
  }
  if (/\b(?:macros?|macronutrients?)\b/.test(q) && /\b(?:what|mean|means|definition|explain|are)\b/.test(q)) {
    return {
      reply: 'Macros are protein, carbohydrates and fat—the main nutrients tracked in Scan. Your plan stores their calorie percentages and shows approximate gram targets; logged meal amounts are separate and may be estimates.',
      sourceIds,
    };
  }
  if (/\bprotein\b/.test(q) && /\b(?:what|does|do|role|function|purpose)\b/.test(q)) {
    return { reply: 'Protein provides amino acids used to build and maintain body tissues. In Scan, the protein target is a planning value; it is not proof of what you ate or individualized medical advice.', sourceIds };
  }
  if (/\b(?:carbs?|carbohydrates?)\b/.test(q) && /\b(?:what|does|do|role|function|purpose)\b/.test(q)) {
    return { reply: 'Carbohydrates are one source of energy and are tracked as a macronutrient in Scan. Your saved target is a planning value; logged meal amounts are separate and may be estimates.', sourceIds };
  }
  if (/\bfat\b/.test(q) && /\b(?:what|does|do|role|function|purpose)\b/.test(q)) {
    return { reply: 'Dietary fat is an energy-yielding macronutrient; Scan uses an approximate 9 kcal per gram when deriving a target from your plan. That target is not logged intake or medical advice.', sourceIds };
  }
  if (/\bprogressive overload\b/.test(q)) {
    return { reply: 'Progressive overload means gradually adjusting a training challenge over time—for example, load, repetitions or sets—while keeping exercise quality and recovery in mind. A saved workout is self-reported and does not verify form or prove a trend by itself.', sourceIds: ['system-education', 'system-coach'] };
  }
  if (/\b(?:what is|what are|define|meaning of)\b/.test(q) && /\b(?:sets?|reps?|repetitions?)\b/.test(q)) {
    return { reply: 'A repetition (rep) is one completed movement. A set is a group of repetitions performed before a rest. Coach records saved sets; unsaved drafts are not part of your saved workout history.', sourceIds: ['system-education', 'system-coach'] };
  }
  if (/\b(?:what is|what are|define|meaning of)\b/.test(q) && /\brest day\b/.test(q)) {
    return { reply: 'A rest or recovery day is a planned day without a workout session in the saved weekly program. Follow the schedule that fits your needs; seek qualified advice for pain or medical concerns.', sourceIds: ['system-education', 'system-coach'] };
  }
  return undefined;
}

export function asksForPersonalRecord(question: string) {
  const intent = classifyChatQuestion(question);
  return intent.personal && !intent.guide;
}

/** Safe arithmetic is deterministic and follows the same saved-plan percentage units as Scan. */
function planTargets(plan: Row): Row {
  const derived = object(plan.macroTargetsGrams);
  const result: Row = {};
  const balanced = ['protein', 'carbs', 'fat'].every(metric => numeric(plan[metric]) && (plan[metric] as number) <= 100) &&
    Math.abs(Number(plan.protein) + Number(plan.carbs) + Number(plan.fat) - 100) < 0.001;
  for (const [metric, energy] of [['protein', 4], ['carbs', 4], ['fat', 9]] as const) {
    result[metric] = numeric(derived[metric]) ? derived[metric]
      : balanced && plan.macrosBalanced !== false && numeric(plan.calories) && numeric(plan[metric]) && (plan[metric] as number) <= 100
        ? Math.round(plan.calories * (plan[metric] as number) / 100 / energy) : null;
  }
  return result;
}

/** Answers exact supported questions from projected current records. Multi-topic answers are combined. */
export function fastRecordAnswer(question: string, sources: Source[], page?: string): FastAnswer | undefined {
  const intent = classifyChatQuestion(question, page);
  if (!intent.personal || intent.guide) return undefined;
  const q = intent.normalized;
  const data = (id: string) => { const source = sources.find(item => item.id === id); return source ? object(source.data) : undefined; };
  const answers: string[] = [], ids = new Set<string>();
  const add = (id: string, reply: string) => { answers.push(reply); ids.add(id); };
  const profile = data('user-profile'), nutrition = data('user-nutrition'), settings = data('user-settings');
  const activity = data('user-activity'), workouts = data('user-workouts'), program = data('user-program');
  const notifications = data('user-notifications'), safety = data('user-safety'), progress = data('user-progress');
  const privateProfile = data('user-private-profile');

  if (privateProfile && (intent.topics.includes('profile') || intent.topics.includes('safety'))) {
    if (privateProfile.profileStatus === 'missing') {
      add('user-private-profile', 'No saved profile is available for this account.');
    } else {
      const healthConditions = /\b(?:conditions?|injur(?:y|ies))\b/.test(q);
      const healthNotes = /\bhealth notes?\b/.test(q);
      const contact = /\b(?:emergency contact|safety contact|contact (?:name|phone|number|relationship))\b/.test(q);
      if (privateProfile.name !== undefined && /\b(?:my name|name did i save|name in my profile|who am i)\b/.test(q)) add('user-private-profile', 'Your saved name is ' + display(privateProfile.name) + '.');
      if (privateProfile.age !== undefined && /\b(?:my age|age did i save|how old am i)\b/.test(q)) add('user-private-profile', 'Your saved age is ' + display(privateProfile.age) + '.');
      if (privateProfile.gender !== undefined && /\b(?:my gender|gender did i save|my sex|sex did i save)\b/.test(q)) add('user-private-profile', 'Your saved gender is ' + display(privateProfile.gender) + '.');
      if (healthConditions || healthNotes) {
        if (healthConditions) {
          const conditions = Array.isArray(privateProfile.conditions)
            ? privateProfile.conditions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : [];
          add('user-private-profile', conditions.length
            ? 'Your saved health conditions: ' + conditions.join(', ') + '.'
            : 'No health conditions are listed in your saved profile.');
        }
        if (healthNotes) add('user-private-profile', 'Your saved health notes: ' + display(privateProfile.healthNotes) + '.');
      }
      if (contact) {
        const contactNameRequested = /\b(?:contact name|contact's name|name (?:of|for) (?:my )?emergency contact|emergency contact(?:'s)? name)\b/.test(q);
        const contactPhoneRequested = /\b(?:contact(?:'s)? (?:phone|number)|emergency contact(?:'s)? (?:phone|number)|(?:phone|number) (?:for|of) (?:my )?emergency contact)\b/.test(q);
        const contactRelationshipRequested = /\b(?:contact relationship|contact's relationship|relationship (?:of|to) (?:my )?emergency contact|emergency contact(?:'s)? relationship)\b/.test(q);
        const allPhrase = /\b(?:(?:who|what) is (?:my )?emergency contact|tell me about (?:my )?emergency contact|emergency contact (?:details|information|info)|safety contact(?: details| information| info)?|contact information|contact details)\b/.test(q);
        const all = allPhrase && !contactNameRequested && !contactPhoneRequested && !contactRelationshipRequested;
        const fields: string[] = [];
        if (all || contactNameRequested) fields.push('name ' + display(privateProfile.contactName));
        if (all || contactPhoneRequested) fields.push('phone ' + display(privateProfile.contactPhone));
        if (all || contactRelationshipRequested) fields.push('relationship ' + display(privateProfile.contactRelationship));
        add('user-private-profile', 'Your saved emergency contact: ' + fields.join('; ') + '.');
      }
    }
  }

  if (nutrition && /\b(?:why|exact|accurate|accuracy)\b/.test(q) && /\b(?:calories|portions?|intake|food)\b/.test(q) && /\b(?:estimat\w*|verify|prove|review)\b/.test(q)) {
    return { reply: 'Saved food calories and macros may be estimates. Food identity, portion size and nutrient values can differ from actual intake. Review these values before saving; a saved entry does not verify exactly what you ate.', sourceIds: ['user-nutrition'] };
  }
  if (nutrition && /\b(?:history|recent food)\b/.test(q) && /\b(?:why|complete|entire|all.time)\b/.test(q)) {
    return { reply: 'Phiq receives only a bounded recent excerpt of saved food history. Older saved entries can be outside that excerpt, so it cannot establish complete or all-time meal history. Daily totals are calculated separately from all saved entries for the selected day; unlogged food remains unknown.', sourceIds: ['user-nutrition'] };
  }
  if (workouts && /\bform\b/.test(q) && /\b(?:verify|prove|confirm|assess)\b/.test(q) && /\b(?:saved|records?|logged)\b/.test(q)) {
    return { reply: 'Saved workout records contain self-reported sets, reps, loads and session status. These records cannot verify exercise form. A live Coach form check is separate from a saved workout record.', sourceIds: ['user-workouts'] };
  }
  if (workouts && /\b(?:timer|timers)\b/.test(q) && /\b(?:live|current|elapsed|confirm|verify)\b/.test(q)) {
    return { reply: 'The live session and rest timers are device state and are unavailable to Phiq. A server-saved active workout can contain confirmed sets and pause metadata, while a completed workout is a separate historical record. Neither record confirms the current live timer or unsaved input. I cannot infer elapsed time from a saved start time alone.', sourceIds: ['user-workouts'] };
  }
  if (workouts && program && /\b(?:prescribed|prescription)\b/.test(q) && /\b(?:completed|saved|logged)\b/.test(q) && /\bsets?\b/.test(q)) {
    const prescriptions = [...new Set(rows(program.days).flatMap(day => rows(day.exercises).map(exercise => display(exercise.name) + ': ' + display(exercise.prescription))))];
    const session = rows(workouts.sessions)[0], sets = rows(session?.completedSets);
    return {
      reply: 'Saved Coach snapshot prescriptions: ' + (prescriptions.length ? prescriptions.join('; ') : 'unavailable') + '.\nMost recent completed workout set excerpt: ' + (sets.length ? sets.map(set => display(set.exercise) + ': ' + display(set.reps) + ' reps at ' + quantity(set.loadKg, 'kg')).join('; ') : 'unavailable') + '.\nThese are separate saved records; the available snapshot may differ from the program used for that workout. A reps/sets prescription does not specify a load unless one is explicitly saved. The excerpt cannot establish total completed sets, exact plan adherence or verified exercise form; loads are self-reported.',
      sourceIds: ['user-program', 'user-workouts'],
    };
  }
  if (workouts && /\b(?:load|strength|improv|trend)\b/.test(q) && /\b(?:why|prove|confirm|evidence|trend)\b/.test(q) && /\b(?:saved|record|workout)\b/.test(q)) {
    return { reply: 'Saved workout loads are self-reported records. A single load or a bounded set of recent sessions cannot establish a strength trend; that would require comparable performance across multiple sessions. The available records do not establish whether your strength improved.', sourceIds: ['user-workouts'] };
  }
  if (notifications && safety && /\bnotifications?\b/.test(q) && /\b(?:safety|alerts?)\b/.test(q) && /\b(?:why|confirm|prove|delivery|delivered)\b/.test(q)) {
    return { reply: 'Unread notifications and safety-alert delivery status are separate records. An unread count only says saved notifications remain unopened; it cannot confirm alert delivery. A saved delivered status, when available, reflects provider status and is not a guarantee that a person received it.', sourceIds: ['user-notifications', 'user-safety'] };
  }
  if (activity && /\bwhy\b/.test(q) && /\bwater\b/.test(q) && /\b(?:mission|quest)\b/.test(q)) {
    const mission = rows(activity.dailyMissions).find(item => /water|hydrat/i.test(String(item.title)));
    if (mission) return { reply: 'Your saved water mission shows ' + display(mission.progress) + ' of ' + display(mission.target) + ' glasses and is marked ' + (mission.complete === true ? 'complete' : 'incomplete') + '. This is the saved daily mission state; it does not verify unlogged drinking.', sourceIds: ['user-activity'] };
  }

  const comparison = /\b(?:compare|different|difference|versus)\b/.test(q);
  if (profile && progress && /\b(?:why|different|difference|compare|versus)\b/.test(q) &&
      /\bprofile weight\b/.test(q) && /\b(?:progress|check.?ins?|measurements?)\b/.test(q)) {
    const latestWeight = object(object(progress.latestByMetric).weight);
    return {
      reply: 'Your saved profile weight is ' + quantity(profile.weight, profile.weightUnit) +
        ', and your latest saved Progress weight check-in is ' + quantity(latestWeight.value, latestWeight.unit) +
        '. These are separate saved fields. The available records do not explain why they differ.',
      sourceIds: ['user-profile', 'user-progress'],
    };
  }
  if (comparison && profile && /\btarget weight\b/.test(q) && /\bcurrent(?: profile)? weight\b/.test(q)) {
    return { reply: 'Your saved current profile weight is ' + quantity(profile.weight, profile.weightUnit) + '. Your target weight is ' + quantity(profile.targetWeight, profile.weightUnit) + '. These are separate saved fields. The records do not state why this target was chosen or when the profile weight was last measured. Progress check-ins are separate records.', sourceIds: ['user-profile'] };
  }
  if (comparison && nutrition && settings && /\b(?:plan|dietary)\b/.test(q) && /\bsettings\b/.test(q) && /\bcalories\b/.test(q)) {
    const plan = object(nutrition.dietaryPlan), target = object(settings.nutritionTargets);
    return { reply: 'Your saved dietary plan calorie target is ' + quantity(plan.calories, 'kcal/day') + '. Your independent saved nutrition-settings target is ' + quantity(target.calories, 'kcal/day') + '. They are separate saved values; Phiq cannot infer why they differ or change either value.', sourceIds: ['user-nutrition', 'user-settings'] };
  }
  if (comparison && activity && /\b(?:all.time|total)\b/.test(q) && /\btoday\b/.test(q)) {
    const state = object(activity.state);
    return { reply: 'Your all-time Quest XP is ' + display(state.totalExperience) + '. Mission points earned today are ' + display(state.earnedPoints) + '. All-time XP accumulates across saved activity; today’s points cover only completed daily missions.', sourceIds: ['user-activity'] };
  }
  const interpretation = /\b(?:why|interpret\w*|keep in mind|drawing|draw|conclude|conclusion)\b/.test(q);
  if (nutrition && interpretation && /\b(?:diet|dietary|plan|target)\b/.test(q) && /\b(?:logged|intake|eaten|ate|consumed)\b/.test(q) && !intent.topics.some(topic => ['coach', 'quests', 'safety', 'notifications'].includes(topic))) {
    const plan = object(nutrition.dietaryPlan), grams = planTargets(plan);
    const date = /\b(?:today|yesterday|\d{4}-\d{2}-\d{2})\b/.exec(q)?.[0] ?? 'today';
    const metrics = ['calories', 'protein', 'carbs', 'fat'].filter(metric => new RegExp('\\b' + metric + '\\b').test(q));
    const names = (metrics.length ? metrics : ['calories', 'protein', 'carbs', 'fat']).join(' ');
    const facts = nutritionRecordAnswer('my dietary plan ' + names + ' target and logged intake ' + date, nutrition, settings, grams);
    const remaining = nutritionRecordAnswer('my ' + names + ' remaining ' + date, nutrition, settings, grams);
    if (facts && remaining) return {
      reply: facts.reply + '\n\n' + remaining.reply + '\n\nA saved plan is a planning target. Logged meals may be estimates or incomplete; they do not verify actual intake. A gap alone cannot establish why the values differ, whether unlogged food was eaten, or what you should eat.',
      sourceIds: [...new Set([...facts.sourceIds, ...remaining.sourceIds])],
    };
  }
  if (progress && interpretation && /\b(?:trend|history)\b/.test(q)) {
    const metric = /\bwaist\b/.test(q) ? 'waist' : /\bbench/.test(q) ? 'benchPress' : 'weight';
    const records = rows(progress.measurements).filter(record => record.metric === metric && numeric(record.value) && present(record.unit));
    return {
      reply: records.length ? 'Available saved ' + metric + ' check-ins: ' + records.map(record => quantity(record.value, record.unit) + ' measured ' + display(record.measuredAt)).join('; ') + '.\n' + (records.length === 1 ? 'Only one comparable check-in is available, so these records cannot establish a trend.' : 'These are a bounded recent excerpt. A trend requires multiple comparable dated measurements in the same units and conditions; missing or older records remain unknown.') + ' Profile values and targets are separate from Progress check-ins; do not treat them as extra dated observations.' : 'No valid comparable check-ins are available to establish that trend. Missing records do not prove that your weight or strength changed.',
      sourceIds: ['user-progress'],
    };
  }
  if (activity && interpretation && /\b(?:rank|ranking|leaderboard|position)\b/.test(q) && /\b(?:level|xp|experience)\b/.test(q)) {
    const state = object(activity.state);
    return { reply: 'Your saved Quest level is ' + display(state.level) + ', with ' + display(state.totalExperience) + ' all-time XP. Level describes your own earned XP. Leaderboard position is unavailable to Phiq because it does not read other accounts or standings. The app has quest-period and strength rankings; your level alone cannot establish either position.', sourceIds: ['user-activity'] };
  }
  const trainingPreferences = /\btraining preferences?\b|\b(?:training days|days.*select|scheduled to train)\b/.test(q);
  if (profile && program && trainingPreferences && /\b(?:distinction|compare|difference|snapshot)\b/.test(q)) {
    return { reply: 'Your saved training preferences: equipment ' + list(profile.equipment) + ', days ' + list(profile.days) + ', planned duration ' + display(profile.duration) + '. Your saved Coach snapshot has goal ' + display(program.goal) + ', duration ' + display(program.duration) + ' and the saved weekly program. The snapshot and profile preferences are separate records. The available records cannot establish which reflects the newest intended preferences.', sourceIds: ['user-profile', 'user-program'] };
  }
  if (/\b(?:recommend|suggest|improve|should|why|compare|difference|trend|advice|better)\b/i.test(q)) return undefined;

  if (nutrition && intent.topics.includes('nutrition')) {
    const answer = nutritionRecordAnswer(q, nutrition, settings, planTargets(object(nutrition.dietaryPlan)));
    if (answer) { answers.push(answer.reply); for (const id of answer.sourceIds) ids.add(id); }
  }

  if (activity && intent.topics.includes('quests')) {
    const state = object(activity.state), pieces: string[] = [];
    if (/\blevel\b/.test(q)) pieces.push('Your Quest level is ' + display(state.level) + '.');
    if (/\b(?:xp|experience)\b/.test(q)) {
      const remaining = /\b(?:next|need|remaining|left|more until)\b/.test(q);
      const within = /\b(?:within|current level|toward)\b/.test(q);
      if (remaining) pieces.push('XP still needed for the next level: ' + display(state.experienceToNextLevel) + '.');
      if (within && (!remaining || /\bearned\b/.test(q))) pieces.push('You have earned ' + display(state.currentExp) + ' XP toward the ' + display(state.nextLevelExp) + ' XP needed within this level.');
      if (!remaining && !within || /\b(?:total|all.time)\b/.test(q)) pieces.push('Your all-time Quest XP is ' + display(state.totalExperience) + '.');
    }
    if (/\bpoints?\b/.test(q)) pieces.push(/\b(?:total|all.time|overall)\b/.test(q)
      ? 'Your all-time Quest points (XP) are ' + display(state.totalExperience) + '.'
      : 'Points earned from completed missions today: ' + display(state.earnedPoints) + '.');
    if (/\bstreak\b/.test(q)) pieces.push('Your current streak is ' + display(state.dayStreak) + ' days. The app calculates up to 365 days.');
    if (/\bmissions?\b/.test(q)) {
      const missions = rows(activity.dailyMissions);
      if (/\bhow many\b/.test(q)) pieces.push('Your saved daily missions: ' + missions.filter(mission => mission.complete === true).length + ' of ' + missions.length + ' complete.');
      for (const mission of missions) pieces.push(display(mission.title) + ': ' + display(mission.progress) + '/' + display(mission.target) + (mission.complete === true ? ' — complete' : ' — not complete') + '.');
    }
    if (/\bbadges?\b/.test(q)) {
      const badges = rows(activity.badges).filter(badge => badge.earned === true && badge.available !== false).map(badge => display(badge.title));
      pieces.push(badges.length ? 'Your earned badges: ' + badges.join(', ') + '.' : 'Your Quest summary lists no earned badges.');
      pieces.push('Ranking-dependent badges are unavailable to Phiq.');
    }
    if (/\b(?:next one|more until)\b/.test(q) && !/\b(?:xp|experience)\b/.test(q)) pieces.push('XP still needed for the next level: ' + display(state.experienceToNextLevel) + '.');
    if (pieces.length) add('user-activity', pieces.join('\n'));
  }

  if (profile && intent.topics.includes('profile') && (!/\b(?:latest|recent|history|progress|check.in)\b/.test(q) || /\bcurrent profile weight\b/.test(q)) && (!intent.topics.includes('nutrition') || /\b(?:weight|height|waist|chest|arms?)\b/.test(q))) {
    const pieces: string[] = [];
    if (/\bgoal\b/.test(q) && !/\bweight goal\b/.test(q)) pieces.push('Your saved goal is ' + display(profile.goal) + '.');
    const target = /\btarget weight\b|\bweight target\b|\baiming for\b|\bweight goal\b/.test(q);
    const targetDateOnly = /\btarget date\b/.test(q) && !/\bweight\b/.test(q);
    if (target && !targetDateOnly) pieces.push('Your target weight is ' + quantity(profile.targetWeight, profile.weightUnit) + '.');
    if (/\b(?:target date|deadline)\b/.test(q)) pieces.push('Your target date is ' + display(profile.targetDate) + '.');
    if (/\bweight\b/.test(q) && (!target || /\bcurrent\b|\bweight goal\b/.test(q))) pieces.push('Your saved current weight is ' + quantity(profile.weight, profile.weightUnit) + '.');
    if (/\bheight\b/.test(q)) pieces.push(profile.heightUnit === 'ft & in.' && present(profile.height)
      ? 'Your saved height is ' + profile.height + ' ft ' + display(profile.heightInches) + ' in.'
      : 'Your saved height is ' + quantity(profile.height, profile.heightUnit) + '.');
    for (const metric of ['waist', 'chest', 'arms']) if (new RegExp('\\b' + (metric === 'arms' ? 'arms?' : metric) + '\\b').test(q)) pieces.push('Your saved ' + metric + ' measurement is ' + quantity(profile[metric], profile[metric + 'Unit']) + '.');
    if (pieces.length) add('user-profile', pieces.join('\n'));
  }
  if (progress && /\b(?:latest|recent|progress|check.in|bench)\b/.test(q) && /\b(?:weight|waist|bench|measurements?|progress)\b/.test(q)) {
    const requested = [['weight', /\bweight\b/], ['waist', /\bwaist\b/], ['benchPress', /\bbench/]] as const;
    const metrics = requested.filter(([, pattern]) => pattern.test(q)).map(([metric]) => metric);
    for (const metric of metrics.length ? metrics : requested.map(([metric]) => metric)) {
      const record = rows(progress.measurements).find(record => record.metric === metric);
      add('user-progress', record ? 'Your latest available saved ' + display(record.metric) + ' measurement is ' + quantity(record.value, record.unit) + ', measured ' + display(record.measuredAt) + '. This uses recent saved measurements, not the profile field.' : 'No matching saved ' + metric + ' measurement is available in your recent records.');
    }
  }

  if (intent.topics.includes('coach') || profile && /\b(?:equipment|training (?:days|duration)|scheduled to train)\b/.test(q)) {
    const pieces: string[] = [];
    if (profile && trainingPreferences) add('user-profile', 'Your saved training preferences: equipment ' + list(profile.equipment) + ', training days ' + list(profile.days) + ', planned session duration ' + display(profile.duration) + '.');
    if (profile && /\bequipment\b/.test(q)) { add('user-profile', 'Your saved equipment: ' + list(profile.equipment) + '.'); }
    const active = object(workouts?.activeWorkout);
    const asksSession = /\b(?:active|paused|current workout|saved.*current workout|current.*sets)\b/.test(q) && !/\b(?:program|routine|plan)\b/.test(q);
    const asksRecent = /\b(?:recent|latest|last|completed|saved load)\b/.test(q) && /\b(?:workout|sets|session|load)\b/.test(q);
    if (profile && /\b(?:how long|duration)\b/.test(q) && (!asksSession && !asksRecent || /\bplanned (?:training |session )?duration\b/.test(q))) add('user-profile', 'Your saved planned session duration is ' + display(profile.duration) + '.');
    if (workouts && (asksSession || asksRecent)) {
      const record = asksSession ? active : rows(workouts.sessions)[0];
      if (!record || !Object.keys(record).length) pieces.push(asksSession ? 'No active workout is saved on the server. Unsaved device drafts are not available to Phiq.' : 'No recent completed workout is available in your saved excerpt.');
      else {
        pieces.push((asksSession ? 'Your saved active workout' : 'Your most recent available completed workout') + ': status ' + display(record.status) + ', ' + (record.pausedAt ? 'paused' : asksSession ? 'not paused' : 'ended ' + display(record.endedAt)) + '.');
        if (/\b(?:how long|duration)\b/.test(q)) pieces.push(asksSession ? 'The live elapsed timer is unavailable to Phiq; device timers are separate from the saved workout.' : 'Saved completed duration: ' + (numeric(record.durationSeconds) ? record.durationSeconds / 60 + ' min (' + record.durationSeconds + ' seconds)' : 'unavailable') + '.');
        if (/\bexercises?\b/.test(q)) pieces.push('Exercises in the saved workout excerpt: ' + rows(record.exercises).map(exercise => display(exercise.name)).join(', ') + '. The excerpt may omit other exercises.');
        if (/\b(?:sets|reps|load)\b/.test(q)) {
          const sets = rows(record.completedSets);
          pieces.push(sets.length ? 'Saved completed sets: ' + sets.map(set => display(set.exercise) + ': ' + display(set.reps) + ' reps, ' + quantity(set.loadKg, 'kg')).join('; ') + '.' : 'No completed set results are available in this saved excerpt.');
        }
      }
      add('user-workouts', pieces.join('\n'));
    }
    if (program && !trainingPreferences && !asksSession && !asksRecent && !/\bequipment\b|\b(?:how long|duration)\b/.test(q)) {
      const days = rows(program.days);
      if (!days.length || program.status === 'missing') add('user-program', 'No saved Coach program snapshot is available. Open Coach to load your current program.');
      else {
        const weekday = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].find(day => new RegExp('\\b' + day + '\\b').test(q));
        const rest = /\brest days?\b/.test(q);
        const selected = days.filter(day => weekday ? String(day.name).toLowerCase() === weekday : rest ? day.isWorkoutDay === false : true);
        const detail = /\b(?:contain|instructions?|exercises?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(q);
        const lines = selected.map(day => display(day.name) + ': ' + display(day.title) + (day.isWorkoutDay === false ? ' (rest/recovery)' : detail ? ' — ' + rows(day.exercises).map(exercise => {
          const instructions = Array.isArray(exercise.instructions) ? exercise.instructions.filter(present).join(' ') : '';
          return display(exercise.name) + ' ' + display(exercise.prescription) + (/\binstructions?\b/.test(q) && instructions ? '. ' + instructions : '');
        }).join('; ') : ''));
        add('user-program', 'Your saved Coach program: ' + display(program.goal) + ', ' + display(program.duration) + '.\n' + lines.join('\n') + '\nThis is a saved snapshot and may predate newer preferences.');
      }
    }
  }

  if (notifications && intent.topics.includes('notifications')) {
    const pieces: string[] = [];
    if (/\bunread\b/.test(q)) pieces.push('Your saved unread notification count is ' + display(notifications.unreadCount) + '.');
    if (/\b(?:reminders?|check.in|timezone)\b/.test(q)) {
      const reminder = object(notifications.reminder);
      pieces.push(reminder.enabled === true && present(reminder.hour) && present(reminder.minute)
        ? 'Your saved daily reminder is enabled at ' + String(reminder.hour).padStart(2, '0') + ':' + String(reminder.minute).padStart(2, '0') + ' (' + display(reminder.timezone) + '). Phone delivery still needs permission and a configured push provider.'
        : reminder.enabled === false ? 'Your saved daily reminder is turned off.' : 'Your saved reminder settings are unavailable.');
    }
    if (/\b(?:latest|recent)\b/.test(q) && /\bnotifications?\b/.test(q)) {
      const items = rows(notifications.items);
      pieces.push(items.length ? 'Your recent notification titles: ' + items.map(item => display(item.title) + (item.unread === true ? ' (unread)' : '')).join('; ') + '.' : 'No recent saved notifications are available.');
    }
    if (pieces.length) add('user-notifications', pieces.join('\n'));
  }
  if (settings && intent.topics.includes('settings')) {
    const pieces: string[] = [], all = /\b(?:explain|summarize|my settings)\b/.test(q) && !/\b(?:threshold|inactivity|alarm|visibility)\b/.test(q);
    if (all || /\binactivity\b/.test(q)) pieces.push('Your saved inactivity monitoring setting is ' + enabled(settings.inactivity) + '.');
    if (all || /\bthreshold\b/.test(q)) pieces.push('Your saved inactivity threshold is ' + (present(settings.threshold) ? settings.threshold + ' seconds' : 'unavailable') + '.');
    if (all || /\balarm\b/.test(q)) pieces.push('Your saved alarm sound setting is ' + enabled(settings.alarmVolume) + '.');
    if (all || /\bvisibility\b|\bvisible\b/.test(q)) pieces.push('Your saved leaderboard visibility is ' + (typeof settings.showLeaderboard === 'boolean' ? settings.showLeaderboard ? 'visible' : 'hidden' : 'unavailable') + '.');
    if (all || /\bnotifications?\b/.test(q)) pieces.push('Your saved notification setting is ' + enabled(settings.notifications) + '.');
    if (pieces.length) add('user-settings', pieces.join('\n'));
  }
  if (safety && intent.topics.includes('safety')) {
    const event = rows(safety.events)[0];
    add('user-safety', event ? 'Your latest available saved safety event: ' + display(event.eventType) + ', status ' + display(event.status) + ', occurred ' + display(event.occurredAt) + '. This reflects saved provider status and is not a guarantee that a person received it.'
      : 'No saved safety alert is available in the recent excerpt. Missing records do not prove there were no past alerts.');
  }
  return answers.length ? { reply: answers.join('\n\n'), sourceIds: [...ids] } : undefined;
}
