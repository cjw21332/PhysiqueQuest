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
          </svg>
          <div className="calorie-center">
            <b className="calorie-value">{Math.round(calories).toLocaleString()}</b>
            <small className="calorie-label">kcal logged today</small>
          </div>
        </div>
        <div className="daily-macros">
          <div className="remaining-label"><small><b>{new Set(meals.map((m) => m.meal)).size}</b> meal{new Set(meals.map((m) => m.meal)).size === 1 ? '' : 's'} logged today</small></div>
          <div className="daily-macros-grid">
            <Macro label="Protein" value={protein} />
            <Macro label="Carbs" value={carbs} />
            <Macro label="Fats" value={fats} />
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
            const totalCarbs = entries.reduce((sum, item) => sum + item.carbs, 0);
            const totalFats = entries.reduce((sum, item) => sum + item.fat, 0);

            return (
              <div className="log-meal-card" key={meal}>
                <div className="log-meal-header">
                  <div className="log-meal-title">
                    <b className="log-meal-name">{meal}</b>
                    {entries.length > 0 && (
                      <div className="log-meal-quick-stats">
                        <span>{Math.round(total).toLocaleString()} kcal · {entries.length} ingredient{entries.length === 1 ? '' : 's'}</span>
                        <span>P: {totalProtein.toFixed(1)}g</span>
                        <span>C: {totalCarbs.toFixed(1)}g</span>
                        <span>F: {totalFats.toFixed(1)}g</span>
                      </div>
                    )}
                  </div>
                  {entries.length > 0
                    ? <strong className="log-meal-total">{Math.round(total).toLocaleString()} kcal</strong>
                    : <button onClick={() => onAdd(meal)} className="log-meal-add-btn" aria-label={`Log ${meal}`}>Log</button>}
                </div>
                {entries.length > 0 && (
                  <div className="log-meal-entries" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {entries.map((item, idx) => (
                      <div key={item.id} className="log-meal-entry" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="entry-name" style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
                          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{Math.round(item.calories * 10) / 10} kcal</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: 4 }}>
                          {item.source} · {item.time}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 2 }}>
                          P {item.protein.toFixed(1)}g · C {item.carbs.toFixed(1)}g · F {item.fat.toFixed(1)}g
                        </div>
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

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w+/g, (c) => c.charAt(0).toUpperCase() + c.slice(1));
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className="scan-macro">
      <div><span>{label}</span><small>{Math.round(value)} g logged</small></div>
    </div>
  );
}
