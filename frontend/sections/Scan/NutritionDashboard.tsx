'use client';

import { Icon } from '../Home/icons';
import { mealNames, nutritionTargets, type FoodEntry, type MealName } from './types';

const calorieTarget = nutritionTargets.calories;
const macroTargets = { Protein: nutritionTargets.protein, Carbs: nutritionTargets.carbs, Fats: nutritionTargets.fats };
const ringCircumference = 2 * Math.PI * 43;

export default function NutritionDashboard({
  meals,
  water,
  onScan,
  onAdd,
  onLogs,
  onHistory,
}: {
  meals: FoodEntry[];
  water: number;
  onScan: () => void;
  onAdd: (meal: MealName) => void;
  onLogs: () => void;
  onHistory: () => void;
}) {
  const calories = meals.reduce((sum, item) => sum + item.calories, 0);
  const protein = meals.reduce((sum, item) => sum + item.protein, 0);
  const carbs = meals.reduce((sum, item) => sum + item.carbs, 0);
  const fats = meals.reduce((sum, item) => sum + item.fat, 0);
  const calorieProgress = Math.min(100, Math.max(0, (calories / calorieTarget) * 100));

  return (
    <div className="scan-dashboard">
      <header className="scan-dashboard-header">
        <h1>Nutrition</h1>
        <button type="button" className="scan-dashboard-manual" onClick={() => onAdd('Dinner')}>
          <span aria-hidden="true">＋</span> Manual entry
        </button>
      </header>

      <section className="scan-dashboard-summary" aria-label="Today's nutrition">
        <div className="scan-dashboard-calorie-ring" role="img" aria-label={`${Math.round(calories)} of ${calorieTarget} calories today`}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="scan-ring-track" cx="50" cy="50" r="43" />
            <circle
              className="scan-ring-progress"
              cx="50"
              cy="50"
              r="43"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringCircumference * (1 - calorieProgress / 100)}
            />
          </svg>
          <span className="scan-ring-value">{Math.round(calories).toLocaleString()}</span>
          <span className="scan-ring-target">of {calorieTarget.toLocaleString()} kcal</span>
        </div>

        <div className="scan-dashboard-macros">
          <p className="scan-calories-remaining">
            <strong>{Math.max(0, Math.round(calorieTarget - calories)).toLocaleString()} kcal</strong> remaining
          </p>
          <MacroBar label="Protein" current={protein} target={macroTargets.Protein} />
          <MacroBar label="Carbs" current={carbs} target={macroTargets.Carbs} />
          <MacroBar label="Fats" current={fats} target={macroTargets.Fats} />
        </div>
      </section>

      <button type="button" className="scan-dashboard-scan" onClick={onScan}>
        <span className="scan-dashboard-scan-icon"><Icon name="scan" size={22} /></span>
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
            const mealCalories = entries.reduce((sum, item) => sum + item.calories, 0);
            const detail = entries.map((item) => item.detail || item.name).join(' · ');
            return (
              <article className="scan-dashboard-meal" key={mealName}>
                <div className="scan-dashboard-meal-head">
                  <h3>{mealName}</h3>
                  <span>{entries.length ? `${Math.round(mealCalories).toLocaleString()} kcal` : 'Not logged'}</span>
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
        <button type="button" className="scan-dashboard-link" onClick={onLogs}>
          <span className="scan-dashboard-link-icon water"><Icon name="water" size={19} /></span>
          <span><strong>Log &amp; water intake</strong><small>{water} of 8 glasses today</small></span>
          <Icon name="arrow" size={16} />
        </button>
        <button type="button" className="scan-dashboard-link" onClick={onHistory}>
          <span className="scan-dashboard-link-icon history"><Icon name="trend" size={19} /></span>
          <span><strong>Food history</strong><small>Review your saved meals</small></span>
          <Icon name="arrow" size={16} />
        </button>
      </section>
    </div>
  );
}

function MacroBar({ label, current, target }: { label: string; current: number; target: number }) {
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
