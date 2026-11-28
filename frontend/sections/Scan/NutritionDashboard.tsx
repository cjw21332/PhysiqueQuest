'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { defaultMeal } from './defaultMeal';
import AdditionalNutrition from '../Scan/AdditionalNutrition';
import { nutrientTotal, nutrientLabel, knownNutrientTotal } from '../Scan/nutrientTotal';

import { Icon } from '../Home/icons';
import TabHeader from '../../components/TabHeader';
import CalorieProgress from '../Home/CalorieProgress';
import { nutritionTargets, type FoodEntry, type MealName } from './types';
import MealDiary from './MealDiary';
import WaterTracker from './WaterTracker';
import { summarizeHistory } from './nutritionPresentation';
import { carbonForPeriod, CAR_KG_PER_KM, type CarbonPeriod } from '../../lib/foodCarbon';
import { formatLocalDate } from '../../lib/localDate.mjs';

const CARBON_PERIODS: { key: CarbonPeriod; label: string; previous: string }[] = [
  { key: 'day', label: 'Day', previous: 'the day before' },
  { key: 'week', label: 'Week', previous: 'last week' },
  { key: 'month', label: 'Month', previous: 'last month' },
  { key: 'year', label: 'Year', previous: 'last year' },
  { key: 'all', label: 'All time', previous: '' },
];
const kgText = (kg: number) => kg >= 100 ? Math.round(kg).toLocaleString('en-US') : kg.toFixed(1);
const dateText = (day: string, options: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', options);
function carbonRangeLabel(period: CarbonPeriod, from: string, to: string, firstLogged: string | null) {
  if (period === 'all') return firstLogged ? `Every log since ${dateText(firstLogged, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Every food you log in Scan';
  if (period === 'day') return dateText(from, { weekday: 'long', month: 'short', day: 'numeric' });
  if (period === 'week') return `${dateText(from, { month: 'short', day: 'numeric' })} – ${dateText(to, { month: 'short', day: 'numeric' })}`;
  if (period === 'month') return dateText(from, { month: 'long', year: 'numeric' });
  if (period === 'year') return from.slice(0, 4);
  return from === to ? 'All your logged meals' : `Since ${dateText(from, { month: 'short', year: 'numeric' })}`;
}

/** Estimated food CO2e by day (default), week, month, year or all time, with its sources and local swaps. */
function FoodCarbon({ entries, anchor }: { entries: FoodEntry[]; anchor: string }) {
  const [period, setPeriod] = useState<CarbonPeriod>('day');
  const data = useMemo(() => carbonForPeriod(entries, period, anchor), [entries, period, anchor]);
  const option = CARBON_PERIODS.find(item => item.key === period)!;
  const peak = Math.max(0, ...data.buckets.map(bucket => bucket.kg));
  const top = data.buckets.find(bucket => bucket.kg === peak && peak > 0);
  const change = data.previousKg ? Math.round((data.totalKg - data.previousKg) / data.previousKg * 100) : null;
  const dense = data.buckets.length > 12;
  const unit = period === 'day' ? 'meal' : period === 'week' || period === 'month' ? 'day' : data.buckets[0]?.key.length === 4 ? 'year' : 'month';
  const current = period === 'year' || (period === 'all' && unit === 'month') ? anchor.slice(0, 7) : period === 'all' ? anchor.slice(0, 4) : anchor;
  return <section className="food-carbon carbon-card" aria-labelledby="carbon-title">
    <header className="carbon-head">
      <span className="carbon-leaf" aria-hidden="true">🌱</span>
      <div><h3 id="carbon-title">Food carbon footprint</h3><p>{carbonRangeLabel(period, data.from, data.to, data.firstLogged)}</p></div>
    </header>
    <div className="carbon-periods" role="tablist" aria-label="Footprint period">{CARBON_PERIODS.map(item => <button key={item.key} type="button" role="tab" aria-selected={period === item.key} onClick={() => setPeriod(item.key)}>{item.label}</button>)}</div>
    <div className="carbon-total" role="tabpanel" aria-label={`${option.label} footprint`}>
      <p><strong>{kgText(data.totalKg)}</strong><span>kg CO₂e</span></p>
      {change !== null && change !== 0 && <span className={`carbon-change ${change > 0 ? 'is-up' : 'is-down'}`}>{change > 0 ? '▲' : '▼'} {Math.abs(change)}% vs {option.previous}</span>}
    </div>
    {data.foods ? <>
      <p className="carbon-meta">{data.foods} {data.foods === 1 ? 'food' : 'foods'}{period !== 'day' && <> · {data.daysLogged} {data.daysLogged === 1 ? 'day' : 'days'} logged · {kgText(data.perDayKg)} kg a day</>} · like driving {Math.round(data.drivingKm).toLocaleString('en-US')} km{data.undated > 0 && <> · {data.undated} waiting to sync, counted but not charted</>}</p>
      <div className={`carbon-chart${dense ? ' is-dense' : ''}`} role="img" aria-label={`Footprint per ${unit}${top ? `; highest: ${top.label}, ${kgText(top.kg)} kg` : ''}`}>
        {data.buckets.map((bucket, index) => <div key={bucket.key} className={`carbon-col${bucket.key === current ? ' is-current' : ''}`}>
          <span className="carbon-col-track"><i style={{ height: `${peak ? Math.max(bucket.kg ? 6 : 0, bucket.kg / peak * 100) : 0}%` }}/></span>
          <small aria-hidden="true">{!dense || index % 7 === 0 ? bucket.label : ''}</small>
        </div>)}
      </div>
      <ul className="carbon-sources" aria-label="Biggest sources">{data.bySource.slice(0, 5).map(row => <li key={row.group}>
        <span className="carbon-source-name">{row.group}</span>
        <span className="carbon-share" aria-hidden="true"><i style={{ width: `${Math.max(3, row.share * 100)}%` }}/></span>
        <b>{kgText(row.kg)} kg</b>
      </li>)}</ul>
      {data.swaps.map(swap => <p className="carbon-swap" key={swap}>{swap}</p>)}
    </> : <p className="carbon-empty">{period === 'day' ? 'No meals logged on this day yet.' : 'No meals logged in this period yet.'} Log meals to see their footprint.</p>}
    <p className="carbon-note">Estimates from food type and portion (Poore &amp; Nemecek 2018); foods without a weight count as 150 g. The driving comparison uses {CAR_KG_PER_KM} kg CO₂e per km for an average petrol car.</p>
  </section>;
}

export default function NutritionDashboard({
  targets = nutritionTargets, onPlan, onSupplements,
  meals,
  historyMeals = meals,
  water,
  onScan,
  onAdd,
  onHistory,
  onEdit,
  onWater,
  highlightedMeal, readOnly = false, dayPicker, mealsHeading = "Today's meals", day = formatLocalDate(),
}: {
  targets?: typeof nutritionTargets;
  onPlan: () => void;
  onSupplements: () => void;
  meals: FoodEntry[];
  historyMeals?: FoodEntry[];
  water: number;
  onScan: () => void;
  onAdd: (meal: MealName) => void;
  onHistory: () => void;
  onEdit: (entries: FoodEntry[]) => void;
  onWater: (value: number) => Promise<void>;
  readOnly?: boolean;
  highlightedMeal?: MealName;
  /** Rendered under the Nutrition / Manual entry row. */
  dayPicker?: ReactNode;
  mealsHeading?: string;
  /** Day chosen in the day picker (YYYY-MM-DD); the carbon card's periods are around it. */
  day?: string;
}) {
  const calorieTarget = targets.calories;
  const macroTargets = { Protein: targets.protein, Carbs: targets.carbs, Fats: targets.fats };
  const calories = nutrientTotal(meals, item => item.calories);
  const protein = nutrientTotal(meals, item => item.protein);
  const carbs = nutrientTotal(meals, item => item.carbs);
  const fats = nutrientTotal(meals, item => item.fat);
  const knownCalories = knownNutrientTotal(meals, item => item.calories);
  const knownProtein = knownNutrientTotal(meals, item => item.protein);
  const knownCarbs = knownNutrientTotal(meals, item => item.carbs);
  const knownFats = knownNutrientTotal(meals, item => item.fat);
  const missingFoods = meals.filter(item => [item.calories, item.protein, item.carbs, item.fat].some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0));
  const historyAverage = summarizeHistory(historyMeals, 7).average;

  return (
    <div className="scan-dashboard">
      <TabHeader as="h1" className="scan-dashboard-header" eyebrow="Track your meals" title="Nutrition">
        {!readOnly && <button type="button" className="scan-dashboard-manual pq-header-action" onClick={() => onAdd(defaultMeal())}>
          <Icon name="plus" size={16}/>Manual entry
        </button>}
      </TabHeader>
      {dayPicker}

      <section className="scan-dashboard-summary" aria-label="Today's nutrition">
        <CalorieProgress calories={calories ?? knownCalories.total} target={calorieTarget} detailed partial={calories === null && knownCalories.total !== null}/>
        <div className="scan-dashboard-macros">
          <p className="scan-calories-remaining">{calories === null ? 'Daily total incomplete' : <><strong>{calories > calorieTarget ? nutrientLabel(calories - calorieTarget, 'kcal') : nutrientLabel(calorieTarget - calories, 'kcal')}</strong> {calories > calorieTarget ? 'over target' : 'remaining'}</>}</p>
          <MacroBar label="Protein" current={protein} known={knownProtein.total} target={macroTargets.Protein}/><MacroBar label="Carbs" current={carbs} known={knownCarbs.total} target={macroTargets.Carbs}/><MacroBar label="Fats" current={fats} known={knownFats.total} target={macroTargets.Fats}/>
        </div>
      </section>
      {missingFoods.length > 0 && <p className="meal-multiple-hint" role="status">Some nutrition is missing for {missingFoods.map(item => item.name).join(', ')}. Totals show known values only; edit these foods to complete your daily summary.</p>}

      <AdditionalNutrition entries={meals}/>
      <FoodCarbon entries={historyMeals} anchor={day}/>
      {readOnly && <div className="scan-dashboard-scan is-locked" aria-disabled="true">
        <span className="scan-dashboard-scan-icon"><Icon name="lock" size={20} /></span>
        <span className="scan-dashboard-scan-copy"><strong>Meal scanning is paused</strong><small>Available again once you&apos;re connected</small></span>
      </div>}
      {!readOnly && <button type="button" className="scan-dashboard-scan" onClick={onScan}>
        <span className="scan-dashboard-scan-icon"><Icon name="camera" size={22} /></span>
        <span className="scan-dashboard-scan-copy">
          <strong>Scan your meal</strong>
          <small>Snap your plate — we&apos;ll estimate the macros</small>
        </span>
        <Icon name="arrow" size={18} />
      </button>}

      <section className="scan-dashboard-meals" aria-labelledby="scan-today-heading">
        <div className="diary-heading"><h2 id="scan-today-heading">{mealsHeading}</h2></div>
        <p className="meal-multiple-hint">{readOnly ? 'Open a meal to view saved foods. Connect to make changes.' : 'Open a meal to see and edit each food.'}</p>
        <MealDiary readOnly={readOnly} meals={meals} onAdd={onAdd} onEdit={onEdit} initialOpen={highlightedMeal}/>
      </section>

      <WaterTracker readOnly={readOnly} water={water} onWater={onWater}/>

      <section className="scan-dashboard-more" aria-labelledby="scan-more-heading">
        <h2 id="scan-more-heading">More</h2>
        <button type="button" className="scan-dashboard-link" onClick={onPlan}><span className="scan-dashboard-link-icon plan"><Icon name="meal" size={19} /></span><span><strong>My dietary plan</strong><small>{readOnly ? 'View saved targets and meal schedule' : 'Manage targets and meal schedule'}</small></span><Icon name="arrow" size={16} /></button>
        <button type="button" className="scan-dashboard-link" onClick={onSupplements}><span className="scan-dashboard-link-icon supplements"><Icon name="shield" size={19} /></span><span><strong>Supplement guide</strong><small>Benefits, doses, side effects and safety marks</small></span><Icon name="arrow" size={16} /></button>
        <button type="button" className="scan-dashboard-link" onClick={onHistory}>
          <span className="scan-dashboard-link-icon history"><Icon name="chart-bars" size={19} /></span>
          <span><strong>Food history</strong><small>{historyAverage ? `7-day average ${historyAverage.toLocaleString()} kcal` : 'Review your saved meals'}</small></span>
          <Icon name="arrow" size={16} />
        </button>
      </section>
    </div>
  );
}

function MacroBar({ label, current, known, target }: { label: string; current: number | null; known: number | null; target: number }) {
  const shown = current ?? known;
  const progress = shown === null || target <= 0 ? 0 : Math.min(100, Math.max(0, (shown / target) * 100));
  return (
    <div className="scan-dashboard-macro" data-macro={label.toLowerCase()}>
      <div><span>{label}</span><small>{current === null ? shown === null ? 'Unavailable' : `${Math.round(shown)} g` : `${Math.round(current)} / ${target} g`}</small></div>
      <div className="scan-dashboard-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} {...(current === null ? { 'aria-valuetext': shown === null ? 'Unavailable' : `${Math.round(shown)} grams known; total incomplete` } : { 'aria-valuenow': Math.min(target, Math.round(current)) })}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
