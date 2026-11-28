'use client';
import type { ReactNode } from 'react';
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
import { weeklyFoodCarbon } from '../../lib/foodCarbon';
import { formatLocalDate } from '../../lib/localDate.mjs';

/** Estimated food CO2e for the last 7 logged days, with local eco-friendly swaps. */
function FoodCarbon({ entries }: { entries: FoodEntry[] }) {
  const week = weeklyFoodCarbon(entries, formatLocalDate());
  if (!week.bySource.length) return null;
  return <details className="food-carbon"><summary>Food carbon footprint · {week.totalKg.toFixed(1)} kg CO₂e this week</summary>
    {week.bySource.map(row => <div className="food-value" key={row.group}><span>{row.group}</span><b>{row.kg.toFixed(1)} kg</b></div>)}
    {week.swaps.map(swap => <p className="meal-multiple-hint" key={swap}>🌱 {swap}</p>)}
    <p className="meal-multiple-hint">Estimates from food type and portion; foods without a weight count as 150 g.</p>
  </details>;
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
  highlightedMeal, readOnly = false, dayPicker, mealsHeading = "Today's meals",
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
      <FoodCarbon entries={historyMeals}/>
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
