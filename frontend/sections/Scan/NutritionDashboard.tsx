'use client';
import AdditionalNutrition from '../Scan/AdditionalNutrition';
import { nutrientTotal, nutrientLabel } from '../Scan/nutrientTotal';

import { Icon } from '../Home/icons';
import CalorieProgress from '../Home/CalorieProgress';
import { nutritionTargets, type FoodEntry, type MealName } from './types';
import MealDiary from './MealDiary';
import WaterTracker from './WaterTracker';
import { summarizeHistory } from './nutritionPresentation';

export default function NutritionDashboard({
  targets = nutritionTargets, onPlan,
  meals,
  historyMeals = meals,
  water,
  onScan,
  onAdd,
  onLogs,
  onHistory,
  onEdit,
  onWater,
}: {
  targets?: typeof nutritionTargets;
  onPlan: () => void;
  meals: FoodEntry[];
  historyMeals?: FoodEntry[];
  water: number;
  onScan: () => void;
  onAdd: (meal: MealName) => void;
  onLogs: () => void;
  onHistory: () => void;
  onEdit: (entries: FoodEntry[]) => void;
  onWater: (value: number) => Promise<void>;
}) {
  const calorieTarget = targets.calories;
  const macroTargets = { Protein: targets.protein, Carbs: targets.carbs, Fats: targets.fats };
  const calories = nutrientTotal(meals, item => item.calories);
  const protein = nutrientTotal(meals, item => item.protein);
  const carbs = nutrientTotal(meals, item => item.carbs);
  const fats = nutrientTotal(meals, item => item.fat);
  const historyAverage = summarizeHistory(historyMeals, 7).average;

  return (
    <div className="scan-dashboard">
      <header className="scan-dashboard-header">
        <h1>Nutrition</h1>
        <button type="button" className="scan-dashboard-manual" onClick={() => onAdd('Dinner')}>
          <span aria-hidden="true">＋</span> Manual entry
        </button>
      </header>

      <section className="scan-dashboard-summary" aria-label="Today's nutrition">
        <CalorieProgress calories={calories} target={calorieTarget} detailed/>
        <div className="scan-dashboard-macros">
          <p className="scan-calories-remaining"><strong>{calories === null ? 'Unavailable' : calories > calorieTarget ? nutrientLabel(calories - calorieTarget, 'kcal') : nutrientLabel(calorieTarget - calories, 'kcal')}</strong> {calories !== null && calories > calorieTarget ? 'over target' : 'remaining'}</p>
          <MacroBar label="Protein" current={protein} target={macroTargets.Protein}/><MacroBar label="Carbs" current={carbs} target={macroTargets.Carbs}/><MacroBar label="Fats" current={fats} target={macroTargets.Fats}/>
        </div>
      </section>

      <AdditionalNutrition entries={meals}/>
      <button type="button" className="scan-dashboard-scan" onClick={onScan}>
        <span className="scan-dashboard-scan-icon"><Icon name="camera" size={22} /></span>
        <span className="scan-dashboard-scan-copy">
          <strong>Scan your meal</strong>
          <small>Snap your plate — we&apos;ll estimate the macros</small>
        </span>
        <Icon name="arrow" size={18} />
      </button>

      <section className="scan-dashboard-meals" aria-labelledby="scan-today-heading">
        <div className="diary-heading"><h2 id="scan-today-heading">Today&apos;s meals</h2><button type="button" onClick={onLogs}>View log</button></div>
        <p className="meal-multiple-hint">Open a meal to see and edit each food.</p>
        <MealDiary meals={meals} onAdd={onAdd} onEdit={onEdit}/>
      </section>

      <WaterTracker water={water} onWater={onWater}/>

      <section className="scan-dashboard-more" aria-labelledby="scan-more-heading">
        <h2 id="scan-more-heading">More</h2>
        <button type="button" className="scan-dashboard-link" onClick={onPlan}><span className="scan-dashboard-link-icon"><Icon name="meal" size={19} /></span><span><strong>My dietary plan</strong><small>Manage targets and meal schedule</small></span><Icon name="arrow" size={16} /></button>
        <button type="button" className="scan-dashboard-link" onClick={onLogs}>
          <span className="scan-dashboard-link-icon water"><Icon name="water" size={19} /></span>
          <span><strong>Log &amp; water intake</strong><small>{water} of 8 glasses today</small></span>
          <Icon name="arrow" size={16} />
        </button>
        <button type="button" className="scan-dashboard-link" onClick={onHistory}>
          <span className="scan-dashboard-link-icon history"><Icon name="chart-bars" size={19} /></span>
          <span><strong>Food history</strong><small>{historyAverage ? `7-day average ${historyAverage.toLocaleString()} kcal` : 'Review your saved meals'}</small></span>
          <Icon name="arrow" size={16} />
        </button>
      </section>
    </div>
  );
}

function MacroBar({ label, current, target }: { label: string; current: number | null; target: number }) {
  const progress = current === null || target <= 0 ? 0 : Math.min(100, Math.max(0, (current / target) * 100));
  return (
    <div className="scan-dashboard-macro">
      <div><span>{label}</span><small>{current === null ? 'Incomplete' : `${Math.round(current)} / ${target} g`}</small></div>
      <div className="scan-dashboard-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} {...(current === null ? { 'aria-valuetext': 'Incomplete total' } : { 'aria-valuenow': Math.min(target, Math.round(current)) })}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
