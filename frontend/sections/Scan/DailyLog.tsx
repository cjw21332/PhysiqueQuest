'use client';

import { Icon } from '../Home/icons';
import { mealNames, type FoodEntry, type MealName } from './types';

type DailyLogProps = {
  meals: FoodEntry[];
  water: number;
  onBack: () => void;
  onHistory: () => void;
  onAdd: (meal: MealName) => void;
  onWater: (value: number) => void;
};

export default function DailyLog({ meals, water, onBack, onHistory, onAdd, onWater }: DailyLogProps) {
  const calories = meals.reduce((sum, item) => sum + item.calories, 0);
  const protein = meals.reduce((sum, item) => sum + item.protein, 0);
  const carbs = meals.reduce((sum, item) => sum + item.carbs, 0);
  const fats = meals.reduce((sum, item) => sum + item.fat, 0);

  return (
    <>
      <header className="scan-header daily-log-header">
        <div className="section-back-title">
          <button className="coach-back" onClick={onBack} aria-label="Back to Nutrition">
            <Icon name="arrow" size={24} />
          </button>
          <h2>Today’s log</h2>
        </div>
        <button className="daily-log-history" onClick={onHistory}>History</button>
      </header>

      <div className="nutrition-summary compact-summary daily-log-summary">
        <div className="calorie-display daily-log-calorie-ring">
          <svg className="calorie-circle-svg" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e8ede9" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--green)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="264"
              strokeDashoffset={264 - (264 * Math.min(calories, 2300)) / 2300}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="calorie-center">
            <b className="calorie-value">{calories.toLocaleString()}</b>
            <small className="calorie-label">of 2,300 kcal</small>
          </div>
        </div>
        <div className="daily-macros">
          <div className="remaining-label"><small><b>{Math.max(0, 2300 - calories).toLocaleString()}</b> kcal remaining</small></div>
          <div className="daily-macros-grid">
            <Macro label="Protein" value={protein} goal={140} />
            <Macro label="Carbs" value={carbs} goal={240} />
            <Macro label="Fats" value={fats} goal={70} />
          </div>
        </div>
      </div>

      <section className="scan-meals log-meals daily-log-meals">
        <div className="section-head">
          <h3>Today&apos;s meals</h3>
          <button className="daily-log-add" onClick={() => onAdd("Dinner")}>+ Add</button>
        </div>
        <div className="daily-log-meal-list">
          {mealNames.map((meal) => {
            const entries = meals.filter((item) => item.meal === meal);
            const total = entries.reduce((sum, item) => sum + item.calories, 0);
            const totalProtein = entries.reduce((sum, item) => sum + item.protein, 0);

            return (
              <div className="log-meal-card" key={meal}>
                <div className="log-meal-header">
                  <div className="log-meal-title">
                    <b className="log-meal-name">{meal}</b>
                    {entries.length > 0 && (
                      <div className="log-meal-quick-stats">
                        <span>{total} kcal</span>
                        <span>P: {Math.round(totalProtein)}g</span>
                      </div>
                    )}
                  </div>
                  {entries.length > 0
                    ? <strong className="log-meal-total">{total.toLocaleString()} kcal</strong>
                    : <button onClick={() => onAdd(meal)} className="log-meal-add-btn" aria-label={`Log ${meal}`}>Log</button>}
                </div>
                {entries.length > 0 && (
                  <div className="log-meal-entries">
                    {entries.map((item, idx) => (
                      <div key={item.id} className="log-meal-entry">
                        <span className="entry-name">{item.name}</span>
                        <span className="entry-meta">{item.source} · {item.time}</span>
                      </div>
                    ))}
                  </div>
                )}
                {entries.length === 0 && (
                  <div className="log-meal-copy">
                    <small>Not logged yet</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="water-log daily-log-water">
        <div className="section-head">
          <h3>Water intake</h3>
          <small>{water} / 8 glasses</small>
        </div>
        <div className="water-glasses">
          {Array.from({ length: 8 }, (_, index) => {
            const glass = index + 1;
            const filled = index < water;
            return (
              <button
                key={glass}
                className={filled ? 'filled' : ''}
                aria-label={`${glass} glasses of water`}
                aria-pressed={filled}
                onClick={() => onWater(glass === water ? glass - 1 : glass)}
              >
                <Icon name="water" size={17} />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Macro({ label, value, goal }: { label: string; value: number; goal: number }) {
  return (
    <div className="scan-macro">
      <div><span>{label}</span><small>{Math.round(value)} / {goal} g</small></div>
      <div className="macro-track"><i style={{ width: `${Math.min(100, value / goal * 100)}%` }} /></div>
    </div>
  );
}
