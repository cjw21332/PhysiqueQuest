'use client';
import AdditionalNutrition from '../Scan/AdditionalNutrition';
import { nutrientTotal, nutrientLabel } from '../Scan/nutrientTotal';
import { titleCase } from '../../lib/titleCase';

import { Icon } from '../Home/icons';
import CalorieProgress from '../Home/CalorieProgress';
import { mealNames, nutritionTargets, type FoodEntry, type MealName } from './types';
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
          <p className="scan-calories-remaining">
            <strong>{calories === null ? 'Unavailable' : nutrientLabel(Math.max(0, calorieTarget - calories), 'kcal')}</strong> remaining
          </p>
          <MacroBar label="Protein" current={protein} target={macroTargets.Protein} />
          <MacroBar label="Carbs" current={carbs} target={macroTargets.Carbs} />
          <MacroBar label="Fats" current={fats} target={macroTargets.Fats} />
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
        <h2 id="scan-today-heading">Today&apos;s meals</h2>
        <div className="scan-dashboard-meal-list">
          {mealNames.map((mealName) => {
            const entries = meals.filter((item) => item.meal === mealName);
            const mealCalories = nutrientTotal(entries, item => item.calories);
            const detail = entries.map((item) => item.detail || titleCase(item.name)).join(' · ');
            return (
              <article className="scan-dashboard-meal" key={mealName}>
                <div className="scan-dashboard-meal-head">
                  <h3>{mealName}</h3>
                  <span>{entries.length ? `${nutrientLabel(mealCalories, 'kcal')}` : 'Not logged'}</span>
                  <button type="button" onClick={() => onAdd(mealName)} aria-label={`Add food to ${mealName}`}>＋</button>
                </div>
                <p>{entries.length ? detail : 'Add what you ate to stay on target'}</p>
              </article>
            );
          })}
        </div>
      </section>

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
  if (current === null) return <div>{label} · Incomplete</div>;
  const progress = Math.min(100, Math.max(0, (current / target) * 100));
  return (
    <div className="scan-dashboard-macro">
      <div><span>{label}</span><small>{Math.round(current)} / {target} g</small></div>
      <div className="scan-dashboard-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(target, Math.round(current))}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
