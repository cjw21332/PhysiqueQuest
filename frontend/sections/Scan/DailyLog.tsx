'use client';
import AdditionalNutrition from '../Scan/AdditionalNutrition';
import { nutrientTotal, nutrientLabel } from '../Scan/nutrientTotal';
import { titleCase } from '../../lib/titleCase';

import { Icon } from '../Home/icons';
import CalorieProgress from '../Home/CalorieProgress';
import { mealNames, nutritionTargets as defaultTargets, type FoodEntry, type MealName } from './types';

type DailyLogProps = {
  targets?: typeof defaultTargets;
  meals: FoodEntry[];
  water: number;
  onBack: () => void;
  onHistory: () => void;
  onAdd: (meal: MealName) => void;
  onEdit: (entries: FoodEntry[]) => void;
  onWater: (value: number) => void;
};


export default function DailyLog({ meals, water, onBack, onHistory, onAdd, onEdit, onWater, targets: nutritionTargets = defaultTargets }: DailyLogProps) {
  const calories = nutrientTotal(meals, item => item.calories);
  const protein = nutrientTotal(meals, item => item.protein);
  const carbs = nutrientTotal(meals, item => item.carbs);
  const fats = nutrientTotal(meals, item => item.fat);

  return (
    <>
      <header className="target-log-header">
        <div className="target-log-title">
          <button type="button" className="coach-back" onClick={onBack} aria-label="Back to Nutrition"><Icon name="arrow" size={20}/></button>
          <h2>Today&apos;s log</h2>
        </div>
        <button type="button" className="target-log-history" onClick={onHistory}>History</button>
      </header>

      <section className="target-log-summary" aria-label="Today's calories and nutrition targets">
        <CalorieProgress calories={calories} target={nutritionTargets.calories} detailed/>

        <div className="target-log-macros">
          <p className="target-log-remaining">
            <strong>{calories === null ? 'Unavailable' : nutrientLabel(Math.max(0, nutritionTargets.calories - calories), 'kcal')}</strong> remaining
          </p>
          <MacroProgress label="Protein" current={protein} target={nutritionTargets.protein} />
          <MacroProgress label="Carbs" current={carbs} target={nutritionTargets.carbs} />
          <MacroProgress label="Fats" current={fats} target={nutritionTargets.fats} />
        </div>
      </section>

      <AdditionalNutrition entries={meals}/>
      <section className="target-log-meals" aria-labelledby="target-log-meals-heading">
        <div className="target-log-section-head">
          <h3 id="target-log-meals-heading">Today&apos;s meals</h3>
          <button type="button" onClick={() => onAdd('Dinner')}>＋ Add</button>
        </div>
        <div className="target-log-meal-list">
          {mealNames.map((meal) => {
            const entries = meals.filter((item) => item.meal === meal);
            const total = nutrientTotal(entries, item => item.calories);
            const names = entries.map((item) => titleCase(item.name)).join(' · ');
            const times = entries.map((item) => [item.source, item.edited ? 'edited' : '', item.time].filter(Boolean).join(' · ')).join(' / ');

            return (
              <article className="target-log-meal" key={meal}>
                {entries.length ? <button type="button" className="target-log-meal-copy target-log-meal-edit" onClick={() => onEdit(entries)} aria-label={`Edit ${meal}: ${names}`}>
                  <p><strong>{meal}</strong>{names && <> · {names}</>} <Icon name="edit" size={13}/></p>
                  <small>{times}</small>
                </button> : <div className="target-log-meal-copy"><p><strong>{meal}</strong></p><small>Not logged yet</small></div>}
                {entries.length
                  ? <strong className="target-log-meal-calories">{nutrientLabel(total, 'kcal')}</strong>
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
                <Icon name="glass" size={15} />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function MacroProgress({ label, current, target }: { label: string; current: number | null; target: number }) {
  if (current === null) return <div>{label} · Incomplete</div>;
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
