'use client';

import { Icon } from '../Home/icons';
import { mealNames, nutritionTargets, type FoodEntry, type MealName } from './types';

type DailyLogProps = {
  meals: FoodEntry[];
  water: number;
  onHistory: () => void;
  onAdd: (meal: MealName) => void;
  onWater: (value: number) => void;
};

const ringCircumference = 2 * Math.PI * 43;

export default function DailyLog({ meals, water, onHistory, onAdd, onWater }: DailyLogProps) {
  const calories = meals.reduce((sum, item) => sum + item.calories, 0);
  const protein = meals.reduce((sum, item) => sum + item.protein, 0);
  const carbs = meals.reduce((sum, item) => sum + item.carbs, 0);
  const fats = meals.reduce((sum, item) => sum + item.fat, 0);
  const calorieProgress = Math.min(100, Math.max(0, (calories / nutritionTargets.calories) * 100));

  return (
    <>
      <header className="target-log-header">
        <h2>Today&apos;s log</h2>
        <button type="button" className="target-log-history" onClick={onHistory}>History</button>
      </header>

      <section className="target-log-summary" aria-label="Today's calories and nutrition targets">
        <div
          className="target-log-ring"
          role="img"
          aria-label={`${Math.round(calories).toLocaleString()} of ${nutritionTargets.calories.toLocaleString()} calories`}
        >
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="target-log-ring-track" cx="50" cy="50" r="43" />
            <circle
              className="target-log-ring-progress"
              cx="50"
              cy="50"
              r="43"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringCircumference * (1 - calorieProgress / 100)}
            />
          </svg>
          <strong>{Math.round(calories).toLocaleString()}</strong>
          <small>of {nutritionTargets.calories.toLocaleString()} kcal</small>
        </div>

        <div className="target-log-macros">
          <p className="target-log-remaining">
            <strong>{Math.max(0, Math.round(nutritionTargets.calories - calories)).toLocaleString()} kcal</strong> remaining
          </p>
          <MacroProgress label="Protein" current={protein} target={nutritionTargets.protein} />
          <MacroProgress label="Carbs" current={carbs} target={nutritionTargets.carbs} />
          <MacroProgress label="Fats" current={fats} target={nutritionTargets.fats} />
        </div>
      </section>

      <section className="target-log-meals" aria-labelledby="target-log-meals-heading">
        <div className="target-log-section-head">
          <h3 id="target-log-meals-heading">Today&apos;s meals</h3>
          <button type="button" onClick={() => onAdd('Dinner')}>＋ Add</button>
        </div>
        <div className="target-log-meal-list">
          {mealNames.map((meal) => {
            const entries = meals.filter((item) => item.meal === meal);
            const total = entries.reduce((sum, item) => sum + item.calories, 0);
            const names = entries.map((item) => item.name).join(' · ');
            const times = entries.map((item) => `${item.source} · ${item.time}`).join(' · ');

            return (
              <article className="target-log-meal" key={meal}>
                <div className="target-log-meal-copy">
                  <p><strong>{meal}</strong>{names && <> · {names}</>}</p>
                  <small>{times || 'Not logged yet'}</small>
                </div>
                {entries.length
                  ? <strong className="target-log-meal-calories">{Math.round(total).toLocaleString()} kcal</strong>
                  : <button
                      type="button"
                      className="target-log-meal-add"
                      aria-label={`Log ${meal}`}
                      onClick={() => onAdd(meal)}
                    >Log</button>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="target-log-water" aria-labelledby="target-log-water-heading">
        <div className="target-log-section-head">
          <h3 id="target-log-water-heading">Water intake</h3>
          <small>{water} / 8 glasses</small>
        </div>
        <div className="target-log-water-glasses">
          {Array.from({ length: 8 }, (_, index) => {
            const glass = index + 1;
            const filled = index < water;
            return (
              <button
                key={glass}
                type="button"
                className={filled ? 'filled' : ''}
                aria-label={`Set water intake to ${glass} glass${glass === 1 ? '' : 'es'}`}
                aria-pressed={filled}
                onClick={() => onWater(glass === water ? glass - 1 : glass)}
              >
                <Icon name="water" size={15} />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function MacroProgress({ label, current, target }: { label: string; current: number; target: number }) {
  const progress = Math.min(100, Math.max(0, (current / target) * 100));
  return (
    <div className="target-log-macro">
      <div><span>{label}</span><small>{Math.round(current)} / {target} g</small></div>
      <div
        className="target-log-macro-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(target, Math.round(current))}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
