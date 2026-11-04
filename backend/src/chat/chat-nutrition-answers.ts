import type { FastAnswer } from './chat-fast-answers.js';

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const display = (value: unknown) => typeof value === 'string' && value.trim() || numeric(value) ? String(value) : 'unavailable';
const quantity = (value: unknown, unit: string) => numeric(value) ? value + ' ' + unit : 'unavailable';
const metrics = ['calories', 'protein', 'carbs', 'fat'] as const;
type Metric = typeof metrics[number];
const unit = (metric: Metric) => metric === 'calories' ? 'kcal' : 'g';

/** Exact nutrition answers distinguish plan percentages, settings grams and logged intake.
 * Totals come from database-computed day summaries, never sums of a truncated excerpt.
 */
export function nutritionRecordAnswer(q: string, nutrition: Row, settings: Row | undefined, grams: Row): FastAnswer | undefined {
  const plan = object(nutrition.dietaryPlan), saved = object(settings?.nutritionTargets);
  const answers: string[] = [], ids = new Set<string>();
  const add = (id: string, value: string) => { answers.push(value); ids.add(id); };
  const requested = metrics.filter(metric => new RegExp('\\b' + metric + '\\b').test(q) || metric !== 'calories' && /\bmacros?\b/.test(q));
  const water = /\b(?:water|drank|drink|drinking)\b/.test(q);
  const consumed = /\b(?:eaten|ate|eat|had|have for|drank|drink|drinking|consumed|logged|log(?: for)?|meals? (?:for |have |today|yesterday)|food history|recent food|saved (?:breakfast|lunch|dinner|snack)|snacks? have i|lunch did i save)\b/.test(q) || requested.length > 0 && /\b(?:today|yesterday|tomorrow|average|mean|(?:this|last) (?:week|month|year)|(?:last|past) \d+ days?)\b|\b\d{4}-\d{2}-\d{2}\b/.test(q) && !/\b(?:targets?|goals?|plan|diet)\b/.test(q);
  const remaining = /\b(?:left|remaining|still need|to go)\b/.test(q) && requested.length > 0;
  const settingsTarget = /\bsettings\b/.test(q) && /\b(?:nutrition|calories|protein|carbs|fat|macros?|targets?)\b/.test(q);
  const explicitTarget = /\bdietary plan\b|\b(?:daily|saved|nutrition|calories|protein|carbs|fat|macro) (?:\w+ )?(?:target|goal)s?\b/.test(q);
  const targetRequest = !remaining && (settingsTarget || (!consumed || explicitTarget) && /\b(?:diet|dietary|plan|macros?|targets?|goals?|following|calories|protein|carbs|fat)\b/.test(q));

  if (targetRequest) {
    const selected = requested.length ? requested : [...metrics];
    if (settingsTarget) {
      add('user-settings', 'Your independently saved nutrition-settings targets:\n' + selected.map(metric => metric + ': ' + quantity(saved[metric === 'fat' ? 'fats' : metric], unit(metric) + '/day') + '.').join('\n'));
    } else if (nutrition.dietaryPlan === null || nutrition.dietaryPlan === undefined) {
      add('user-nutrition', 'No saved dietary plan is available. Open Scan → My Dietary Plan to review or save one.');
      if (metrics.some(metric => numeric(saved[metric === 'fat' ? 'fats' : metric]))) {
        add('user-settings', 'Your independently saved nutrition targets are: ' + metrics.map(metric => metric + ' ' + quantity(saved[metric === 'fat' ? 'fats' : metric], unit(metric) + '/day')).join(', ') + '.');
      }
    } else {
      const pieces: string[] = [];
      const specific = /\b(?:calories|protein|carbs|fat|percentages?|grams?|activity|started|start date)\b/.test(q);
      const showAll = !specific || /\b(?:summarize|summary|look like|targets|macros)\b/.test(q);
      const nameRequested = /\b(?:name of|what is the name)\b.{0,50}\b(?:dietary|diet|nutrition|meal) plan\b|\b(?:dietary|diet|nutrition|meal) plan\b.{0,50}\bname\b/.test(q);
      if (nameRequested) pieces.push('Your saved dietary plan has no separate name. Its saved goal is ' + display(plan.goal) + '.');
      else if (showAll || /\bgoal\b/.test(q) && !specific || /\bplan\b/.test(q) && !specific) pieces.push('Your saved dietary plan goal is ' + display(plan.goal) + '.');
      if (showAll || requested.includes('calories')) pieces.push('Daily calorie target: ' + quantity(plan.calories, 'kcal') + '.');
      for (const metric of ['protein', 'carbs', 'fat'] as const) if (showAll || requested.includes(metric)) {
        pieces.push(metric[0].toUpperCase() + metric.slice(1) + ': ' + (numeric(plan[metric]) ? plan[metric] + '%' : 'unavailable') + ' (' + quantity(grams[metric], 'g/day') + ').');
      }
      if (/\bactivity\b/.test(q)) pieces.push('Saved dietary activity level: ' + display(plan.activity) + '.');
      if (/\b(?:started|start date|when)\b/.test(q)) pieces.push('Plan start date: ' + display(plan.startedAt) + '.');
      if (pieces.length) add('user-nutrition', pieces.join('\n'));
    }
  }

  if (consumed || water || remaining) {
    // Recent excerpts cannot establish a complete weekly/monthly/yearly aggregate.
    const range = /\b(?:this|last|past|per) (?:week|month|year)\b|\b(?:last|past) \d+ days?\b|\b(?:weekly|monthly|yearly|all.time|date range)\b|\b(?:since|between|from)\b.{0,25}\d{4}-\d{2}-\d{2}|\b\d{4}-\d{2}-\d{2}\s+(?:to|through|and)\s+\d{4}-\d{2}-\d{2}\b/.test(q) || new Set(q.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).size > 1;
    if (range && (!nutrition.period || remaining)) {
      add('user-nutrition', remaining ? 'Remaining nutrition for a date range is unavailable because the current daily plan does not establish your historical daily targets. Ask about remaining nutrition for one date.' : 'A complete total for that date range is unavailable to Phiq. Ask for this/last week, this/last month, the past 1–366 days, or an inclusive range of two YYYY-MM-DD dates up to 366 days. Recent food excerpts cannot establish an all-time total.');
      return { reply: answers.join('\n\n'), sourceIds: [...ids] };
    }
    const selected = object(range ? nutrition.period : nutrition.selectedDay ?? nutrition.today);
    if (/\b(?:exact|accurate|estimate)\b/.test(q)) {
      add('user-nutrition', 'Logged food calories and macros may be estimates. Review food identity, portion and nutrition values before relying on them; saving a record does not verify its accuracy.');
    } else if (!range && /\b(?:history|recent food|snacks? have i|saved dinner)\b/.test(q) && !/\b(?:today|yesterday|\d{4}-\d{2}-\d{2})\b/.test(q)) {
      const groups = ['breakfast', 'lunch', 'dinner', 'snack'].filter(meal => q.includes(meal));
      const meals = rows(nutrition.meals).filter(meal => !groups.length || groups.includes(String(meal.meal).toLowerCase())).slice(-8);
      add('user-nutrition', meals.length
        ? 'Available recent saved meals: ' + meals.map(meal => display(meal.name) + ' (' + display(meal.date) + ', ' + quantity(meal.calories, 'kcal') + ')').join('; ') + '. This is a recent excerpt, not complete history.'
        : 'No matching meals are available in your recent saved history. Older records may be outside this excerpt.');
    } else {
      const today = object(nutrition.today);
      const days = /\btoday\b/.test(q) && /\byesterday\b/.test(q) && today.date !== selected.date ? [selected, today] : [selected];
      const groups = ['breakfast', 'lunch', 'dinner', 'snack'].filter(meal => q.includes(meal));
      for (const day of days) {
        if (day.status !== 'available' && day.status !== 'empty') {
          add('user-nutrition', 'Your saved daily nutrition summary is unavailable for ' + display(day.date) + '. I cannot infer intake or water from missing records.');
          continue;
        }
        const pieces: string[] = [], date = display(day.date), totals = object(day.totals);
        if (water) pieces.push('Saved water for ' + date + ': ' + quantity(day.waterGlasses, 'glasses') + '.');
        if (remaining) {
          const hasPlan = nutrition.dietaryPlan !== null && nutrition.dietaryPlan !== undefined;
          for (const metric of requested) {
            const target = hasPlan ? metric === 'calories' ? plan.calories : grams[metric] : saved[metric === 'fat' ? 'fats' : metric];
            const logged = totals[metric];
            if (!hasPlan && numeric(target)) ids.add('user-settings');
            pieces.push(numeric(target) && numeric(logged)
              ? metric + ' remaining for ' + date + ': ' + quantity(Math.max(0, Math.round((target - logged) * 1000) / 1000), unit(metric)) + ' (saved target ' + quantity(target, unit(metric)) + ', logged ' + quantity(logged, unit(metric)) + ')' + (logged > target ? '; logged amount is ' + quantity(Math.round((logged - target) * 1000) / 1000, unit(metric)) + ' above the target.' : '.')
              : metric + ' remaining is unavailable because the saved target or logged daily total is unavailable.');
          }
        } else if (/\b(?:average|mean)\b/.test(q) && requested.length) {
          const perMeal = /\bper (?:saved )?meal\b/.test(q);
          const count = perMeal ? day.mealCount : range ? (Date.parse(String(day.endDate)) - Date.parse(String(day.startDate))) / 86400000 + 1 : 1;
          for (const metric of requested) {
            const total = totals[metric];
            pieces.push(!groups.length && numeric(total) && numeric(count) && count > 0
              ? 'Average logged ' + metric + ' for ' + date + ': ' + quantity(Math.round(total / count * 100) / 100, unit(metric) + (perMeal ? '/entry' : '/day')) + ' (' + quantity(total, unit(metric)) + ' across ' + count + (perMeal ? ' saved meal entries' : ' calendar days, including days without saved logs') + ').'
              : 'Average logged ' + metric + ' is unavailable from these records.');
          }
        } else if (groups.length || !requested.length && (!water || /\b(?:eat|eaten|ate|food|meals?)\b/.test(q))) {
          const meals = rows(day.meals).filter(meal => !groups.length || groups.includes(String(meal.meal).toLowerCase()));
          if (!groups.length && /\bhow many\b/.test(q) && /\b(?:meals?|entries|foods?)\b/.test(q)) pieces.push(display(day.mealCount) + ' saved meal entries for ' + date + '.');
          pieces.push(meals.length ? 'Saved meals for ' + date + ': ' + meals.map(meal => display(meal.name) + ' (' + (requested.length ? requested : ['calories'] as const).map(metric => metric + ' ' + quantity(meal[metric], unit(metric))).join(', ') + ')').join('; ') + '.' : 'No matching meals are saved for ' + date + '.');
          if (numeric(day.mealCount) && day.mealCount > rows(day.meals).length) pieces.push('Only ' + rows(day.meals).length + ' of ' + day.mealCount + ' saved entries are listed; more matching entries may be outside this excerpt.');
        } else for (const metric of requested) pieces.push('Logged ' + metric + ' for ' + date + ': ' + quantity(totals[metric], unit(metric)) + '.');
        if (pieces.length) add('user-nutrition', pieces.join('\n') + ' These are saved records, not verified intake.');
      }
    }
  }
  return answers.length ? { reply: answers.join('\n\n'), sourceIds: [...ids] } : undefined;
}
