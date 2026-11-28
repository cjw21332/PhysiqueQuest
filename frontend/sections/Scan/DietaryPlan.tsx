'use client';
import { Icon } from '../Home/icons';
import { nutrientTotal, nutrientLabel } from '../Scan/nutrientTotal';

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { DietaryPlan as Plan } from '../../hooks/useNutrition';
import type { Profile } from '../Home/types';
import type { FoodEntry } from './types';

const initial: Plan = { goal: 'Maintenance', calories: 2300, protein: 30, carbs: 45, fat: 25 };
const goals = ['Clean Bulk', 'Weight Loss', 'Maintenance', 'Hypertrophy'];
const presets = [{ name: 'High protein', values: [30, 45, 25] }, { name: 'Balanced', values: [25, 50, 25] }, { name: 'Low carb', values: [40, 20, 40] }];
const meals = [{ name: 'Breakfast', key: 'Breakfast', time: '07:30 – 08:30', share: .22, note: 'Start the day with a balanced meal containing protein and carbohydrates.' }, { name: 'Lunch', key: 'Lunch', time: '12:30 – 13:30', share: .30, note: 'Build a meal around protein, carbohydrates and vegetables.' }, { name: 'Afternoon snack', key: 'Snack', time: '16:30', share: .16, note: 'A convenient snack can help you reach your daily targets.' }, { name: 'Dinner', key: 'Dinner', time: '19:30 – 20:30', share: .32, note: 'Finish the day with a balanced meal that fits your remaining targets.' }];
// Filipino staples; "lean" swaps lower-calorie options in for weight-loss plans.
const LOCAL_FOODS: [string, { base: string; lean: string }][] = [
  ['Protein', { base: 'itlog, chicken (tinola, inasal), bangus, galunggong, tokwa, monggo', lean: 'boiled itlog, skinless chicken tinola, paksiw or grilled isda, tokwa, monggo' }],
  ['Carbs', { base: 'kanin (try half brown rice), kamote, saba, mais, pandesal', lean: '1 cup kanin or less, kamote, boiled saba, mais' }],
  ['Vegetables', { base: 'malunggay, kangkong, pechay, sitaw, ampalaya, kalabasa', lean: 'half your plate: kangkong, pechay, sitaw, ampalaya, pinakbet without bagnet' }],
  ['Fruit', { base: 'saging, papaya, mangga, bayabas, pakwan', lean: 'papaya, bayabas, pakwan; keep mangga to a few slices' }],
];
const activities: Record<string, number> ={ Sedentary: 1.2, Light: 1.375, Moderate: 1.55, Active: 1.725, Athlete: 1.9 };
const offsets: Record<string, number> = { 'Clean Bulk': 300, 'Weight Loss': -450, Maintenance: 0, Hypertrophy: 500 };
export const planTargets = (plan: Plan) => ({ calories: plan.calories, protein: Math.round(plan.calories * plan.protein / 400), carbs: Math.round(plan.calories * plan.carbs / 400), fats: Math.round(plan.calories * plan.fat / 900) });

export default function DietaryPlan({ saved, profile, meals: loggedMeals, onBack, readOnly = false }: { readOnly?: boolean; saved: Plan | null; profile: Profile; meals: FoodEntry[]; onBack: () => void }) {
  const [draft, setDraft] = useState<Plan>(saved ?? initial);
  const [tab, setTab] = useState<'Active Plan' | 'Custom Goals' | 'Meal Schedule'>(saved ? 'Active Plan' : 'Custom Goals');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [activityOpen, setActivityOpen] = useState(false);
  const hydrated = useRef(Boolean(saved));
  useEffect(() => { if (saved && !hydrated.current) { hydrated.current = true; setDraft(saved); setTab('Active Plan'); } }, [saved]);
  const targets = planTargets(draft);
  const total = draft.protein + draft.carbs + draft.fat;
  const activity = draft.activity || profile.activity || 'Moderate';
  const weight = Number(profile.weight) * (profile.weightUnit === 'lbs' ? 0.453592 : 1);
  const height = profile.heightUnit === 'ft & in.' ? (Number(profile.height) * 12 + Number(profile.heightInches || 0)) * 2.54 : Number(profile.height);
  const age = Number(profile.age);
  const baseline = weight > 0 && height > 0 && age >= 18 && (profile.gender === 'Male' || profile.gender === 'Female') ? Math.round((10 * weight + 6.25 * height - 5 * age + (profile.gender === 'Male' ? 5 : -161)) * (activities[activity] || 1.55) / 10) * 10 : null;
  const scanned = loggedMeals.filter(item => item.source === 'Scanned');
  const loggedProtein = nutrientTotal(loggedMeals, item => item.protein);
  const delta = baseline ? draft.calories - baseline : null;
  const days = saved?.startedAt ? Math.max(1, Math.floor((Date.now() - new Date(saved.startedAt).getTime()) / 86400000) + 1) : null;
  const hasUnsavedChanges = !!saved && (['goal', 'calories', 'protein', 'carbs', 'fat', 'activity'] as const).some(key => (draft[key] ?? '') !== (saved[key] ?? ''));
  const recommend = async () => {
    setBusy(true); setMessage('');
    try { const proposal = await api.recommendDietaryPlan(); setDraft({ ...proposal, activity, startedAt: saved?.startedAt }); setTab('Custom Goals'); setMessage('AI recommendation ready to review. Save it to apply your targets.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not generate a recommendation.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setMessage('');
    try { const result = await api.setDietaryPlan(draft); hydrated.current = true; setDraft(result.dietaryPlan); setMessage('Plan saved.'); setTab('Active Plan'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your plan.'); }
    finally { setBusy(false); }
  };
  return <div className="diet-plan">
    <header className="diet-header pq-page-heading"><button type="button" className="coach-back" onClick={onBack} aria-label="Back to Nutrition"><Icon name="arrow" size={20}/></button><h2>My Dietary Plan</h2></header>
    <div className="diet-tabs" role="group" aria-label="Dietary plan sections">{(['Active Plan', 'Custom Goals', 'Meal Schedule'] as const).map(item => <button type="button" className={tab === item ? 'active' : ''} aria-pressed={tab === item} key={item} disabled={readOnly && item === 'Custom Goals'} onClick={() => setTab(item)}>{item}</button>)}</div>
    {message && <p role="status" className="diet-message">{message}</p>}
    {tab === 'Active Plan' && scanned.length > 0 && <section className="diet-card"><h3>Today's scans and your plan</h3>
      <p>{scanned.length === 1 ? '1 scanned food entry is' : `${scanned.length} scanned food entries are`} included in today's diary. Your current plan targets {targets.protein} g of protein.</p>
      {loggedProtein !== null ? <p>{nutrientLabel(loggedProtein, 'g')} protein logged across all meals today.</p> : <p>Some entries are missing protein values. Review the portions before comparing your intake with your target.</p>}
      {age >= 18 && saved && loggedProtein !== null && loggedProtein < targets.protein && <p>For your next meal, consider local protein like itlog, tokwa, monggo, bangus, galunggong or chicken tinola. If you regularly struggle to meet your target with food, ask a dietitian whether a protein supplement fits your diet.</p>}
      <a href="https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-Consumer/" target="_blank" rel="noreferrer">NIH guide to exercise supplements</a>
    </section>}
    {tab === 'Active Plan' && <section className="diet-card diet-local" aria-labelledby="diet-local-heading"><h3 id="diet-local-heading">Local food ideas</h3><p className="diet-local-goal">Picked for {draft.goal.toLowerCase()}</p>
      <ul className="diet-local-list">{LOCAL_FOODS.map(([label, foods]) => <li key={label} data-group={label.toLowerCase()}><b>{label}</b><span>{draft.goal === 'Weight Loss' ? foods.lean : foods.base}</span></li>)}</ul>
      <p className="diet-local-supplements"><b>Supplements</b> Food first. If you can&apos;t reach your protein target, a whey or soy protein powder can help; creatine monohydrate (3–5 g a day) has the strongest evidence for strength. Check Nutrition › Supplements for evidence ratings, and ask a doctor first if you have a health condition.</p>
    </section>}
    {tab === 'Active Plan' && <section className="diet-card">
      <span className="diet-badge">{hasUnsavedChanges ? 'Unsaved draft' : saved ? `In progress${days ? ` • Day ${days}` : ''}` : 'Draft plan'}</span><div className="diet-title-row"><h2>{draft.goal}</h2><button type="button" disabled={readOnly} onClick={() => setTab('Custom Goals')}>Change ›</button></div><p>{hasUnsavedChanges ? 'These draft targets are not active until you save them.' : `Your daily nutrition targets and meal allocation for ${draft.goal.toLowerCase()}.`}</p>
      <div className="diet-summary-row"><span><small>Estimated pace</small><strong>{delta === null ? 'Profile details needed' : `${delta >= 0 ? '+' : ''}${(delta * 7 / 7700).toFixed(2)} kg / week`}</strong></span><span><small>Plan check</small><strong>{total === 100 ? 'Targets balanced' : 'Review targets'}</strong></span></div>
      <div className="diet-divider"/><div className="diet-title-row"><small>Daily energy budget</small>{delta !== null && <span className="diet-badge">{delta >= 0 ? '+' : ''}{delta} kcal vs maintenance</span>}</div><div className="diet-energy">{draft.calories.toLocaleString()} <span>kcal / day</span></div>
      <MacroTrack plan={draft}/><div className="diet-macro-grid">{([['Protein', targets.protein, 'Muscle support'], ['Carbs', targets.carbs, 'Daily energy'], ['Fats', targets.fats, 'Dietary fat']] as const).map(([name, grams, note]) => <div key={name} data-macro={name.toLowerCase()}><small>{name}</small><strong>{grams}g</strong><small>{note}</small></div>)}</div>
      <div className="diet-actions"><button className="diet-secondary" type="button" disabled={readOnly} onClick={() => setTab('Custom Goals')}>Edit targets</button><button className="diet-primary" type="button" disabled={readOnly || busy} onClick={() => void recommend()}>{busy ? 'Generating…' : <><Icon name="retake" size={16} /> Regenerate AI</>}</button></div><p className="diet-ai-disclosure">Your age, measurements, gender, activity, goal and aggregate macros from the past week of confirmed food scans are sent to our AI service to suggest a plan. Review the result before saving.</p>
    </section>}
    {tab === 'Custom Goals' && <>
      <section className="diet-card"><div className="diet-title-row"><h2>Fitness Objective &amp; Target</h2></div><div className="diet-goals">{goals.map(goal => <button type="button" key={goal} className={draft.goal === goal ? 'selected' : ''} aria-pressed={draft.goal === goal} onClick={() => setDraft({ ...draft, goal, calories: baseline ? Math.max(1000, Math.min(6000, baseline + offsets[goal])) : draft.calories })}><span><strong>{goal}</strong><small>{offsets[goal] === 0 ? 'Neutral energy' : `${offsets[goal] > 0 ? '+' : ''}${offsets[goal]} kcal/day`}</small></span><span><Icon name={draft.goal === goal ? "check" : "plus"} size={18} /></span></button>)}</div><div className="diet-activity"><div className="diet-title-row"><small>Activity multiplier</small><button type="button" aria-expanded={activityOpen} onClick={() => setActivityOpen(!activityOpen)}>Change ›</button></div>{activityOpen && <label>Activity level<select value={activity} onChange={event => { setDraft({ ...draft, activity: event.target.value }); setActivityOpen(false); }}>{Object.keys(activities).map(item => <option key={item}>{item}</option>)}</select></label>}<strong>{activity}</strong><small>{baseline ? `${baseline.toLocaleString()} estimated maintenance kcal` : 'Add adult profile measurements to estimate maintenance'}</small></div></section>
      <section className="diet-card"><h2>Daily Energy Target</h2><p>Adjust daily baseline intake</p><div className="diet-stepper"><button type="button" aria-label="Decrease calories" onClick={() => setDraft({ ...draft, calories: Math.max(1000, draft.calories - 100) })}><Icon name="minus" size={18}/></button><div className="diet-energy">{draft.calories.toLocaleString()} <span>kcal / day</span></div><button type="button" aria-label="Increase calories" onClick={() => setDraft({ ...draft, calories: Math.min(6000, draft.calories + 100) })}><Icon name="plus" size={18}/></button></div><p className="diet-note">{delta === null ? 'Maintenance and pace require an adult profile with height, weight, age and sex-based inputs.' : `Estimated ${delta >= 0 ? 'surplus' : 'deficit'}: ${Math.abs(delta)} kcal/day. Actual needs and weight changes vary.`}</p></section>
      <section className="diet-card"><div className="diet-title-row"><h2>Macro Distribution Ratio</h2><span className="diet-badge">Total: {total}%</span></div><p>Choose how to divide your daily calories.</p><MacroTrack plan={draft}/>{(['protein', 'carbs', 'fat'] as const).map(key => <div className="diet-macro-row" key={key}><span><strong>{key === 'fat' ? 'Fats' : key[0].toUpperCase() + key.slice(1)} · {draft[key]}%</strong><small>{key === 'fat' ? targets.fats : targets[key]}g per day</small></span><button type="button" aria-label={`Decrease ${key} percentage`} onClick={() => setDraft({ ...draft, [key]: Math.max(1, draft[key] - 1) })}><Icon name="minus" size={18}/></button><input aria-label={`${key} percentage`} type="number" min="1" max="80" value={draft[key]} onChange={event => setDraft({ ...draft, [key]: Number(event.target.value) })}/><button type="button" aria-label={`Increase ${key} percentage`} onClick={() => setDraft({ ...draft, [key]: Math.min(80, draft[key] + 1) })}><Icon name="plus" size={18}/></button></div>)}<small>Preset strategies</small><div className="diet-presets">{presets.map(preset => <button type="button" key={preset.name} onClick={() => setDraft({ ...draft, protein: preset.values[0], carbs: preset.values[1], fat: preset.values[2] })}>{preset.name} ({preset.values.join('/')})</button>)}</div></section>
      <p className="diet-note"><strong>Plan feasibility check</strong><br/>{total === 100 ? 'Your macro percentages add up to 100%. This is not a clinical assessment.' : 'Adjust your macros so they total 100%.'}</p><button className="diet-primary" type="button" disabled={busy || total !== 100 || [draft.protein, draft.carbs, draft.fat].some(n => !Number.isInteger(n) || n < 1 || n > 80)} onClick={() => void save()}>{busy ? 'Saving…' : <><Icon name="check" size={18} /> Save &amp; recalculate plan</>}</button><button className="diet-reset" type="button" disabled={readOnly || busy} onClick={() => void recommend()}><Icon name="retake" size={16} /> Reset to AI recommendation</button><p className="diet-ai-disclosure">Your age, measurements, gender, activity, goal and aggregate macros from the past week of confirmed food scans are sent to our AI service to suggest a plan. Review the result before saving.</p>{total !== 100 && <p className="diet-message">Macro percentages must add up to 100%.</p>}
    </>}
    {tab === 'Meal Schedule' && <section className="diet-schedule" aria-labelledby="diet-schedule-title">
      <div className="diet-schedule-heading"><div><h2 id="diet-schedule-title">Suggested Meal Schedule</h2><p>Suggested timing &amp; macro allocation</p></div><span>{meals.length} meals / day</span></div>
      <div className="diet-schedule-list">{meals.map((meal, index) => <article className="diet-schedule-meal" key={meal.name}>
        <div className="diet-schedule-meal-heading"><span className="diet-schedule-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div className="diet-schedule-identity"><h3><Icon name={`meal-${meal.key.toLowerCase()}`} size={16}/>{meal.name}</h3><p>{meal.time}</p></div><div className="diet-schedule-values"><strong>~{Math.round(draft.calories * meal.share)} kcal</strong><span>{Math.round(targets.protein * meal.share)}g P · {Math.round(targets.carbs * meal.share)}g C · {Math.round(targets.fats * meal.share)}g F</span></div></div>
        <p className="diet-schedule-description">{meal.note} {loggedMeals.some(item => item.meal === meal.key) && `${nutrientLabel(nutrientTotal(loggedMeals.filter(item => item.meal === meal.key), item => item.calories), 'kcal')} logged today.`}</p>
      </article>)}</div>
      <aside className="diet-schedule-coach"><span className="diet-schedule-coach-icon"><Icon name="coach-wand" size={18}/></span><div><h3>Coach note</h3><p>Meals logged in Scan count toward your daily targets. Meal allocations and timing are suggestions.</p></div></aside>
    </section>}
  </div>;
}

function MacroTrack({ plan }: { plan: Plan }) {
  return <><div className="diet-track" aria-label={`Protein ${plan.protein}%, carbs ${plan.carbs}%, fats ${plan.fat}%`}><i style={{ flex: plan.protein }}/><i style={{ flex: plan.carbs }}/><i style={{ flex: plan.fat }}/></div><div className="diet-legend"><span>Protein {plan.protein}%</span><span>Carbs {plan.carbs}%</span><span>Fats {plan.fat}%</span></div></>;
}
