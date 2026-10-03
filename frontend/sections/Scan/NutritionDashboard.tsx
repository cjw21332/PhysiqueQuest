'use client';

import { Icon } from '../Home/icons';
import { mealNames, type FoodEntry, type MealName } from './types';

export default function NutritionDashboard({
  meals,
  water,
  onScan,
  onAdd,
  onLogs,
  onHistory
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

  const remaining = Math.max(0, 2300 - calories);

  return (
    <div className="nutrition-dashboard">
      {/* Header */}
      <header className="nutrition-header">
        <h2 className="nutrition-title">Nutrition</h2>
        <button
          className="manual-entry-btn"
          onClick={() => onAdd('Dinner')}
        >
          ＋ Manual entry
        </button>
      </header>

      {/* Nutrition Overview Card */}
      <div className="nutrition-card">
        <div className="nutrition-card-left">
          <div className="calorie-display">
            <svg className="calorie-circle-svg" viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#eef0ee"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#7ee582"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * calories) / 2300}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="calorie-center">
              <div className="calorie-value">{calories.toLocaleString()}</div>
              <div className="calorie-label">of 2,300 kcal</div>
            </div>
          </div>
        </div>

        <div className="macro-details">
          <div className="remaining-cals">
            <strong>{remaining.toLocaleString()} kcal</strong> remaining
          </div>
          <div className="macros-container">
            <MacroBar label="Protein" current={Math.round(protein)} target={140} unit="g" />
            <MacroBar label="Carbs" current={Math.round(carbs)} target={240} unit="g" />
            <MacroBar label="Fats" current={Math.round(fats)} target={70} unit="g" />
          </div>
        </div>
      </div>

      {/* Scan Meal CTA */}
      <button className="scan-cta" onClick={onScan}>
        <div className="scan-icon-box">
          <Icon name="scan" size={24} />
        </div>
        <div className="scan-text">
          <div className="scan-title">Scan your meal</div>
          <div className="scan-subtitle">
            Snap your plate — we'll estimate the macros
          </div>
        </div>
        <Icon name="arrow" size={18} />
      </button>

      {/* Today's Meals */}
      <section className="meals-section">
        <h3 className="section-heading">Today's meals</h3>
        <div className="meals-list">
          {mealNames.map((mealName) => {
            const entries = meals.filter((item) => item.meal === mealName);
            const totalCals = entries.reduce((sum, item) => sum + item.calories, 0);
            const totalProtein = entries.reduce((sum, item) => sum + item.protein, 0);
            const hasEntries = entries.length > 0;

            return (
              <div key={mealName} className="meal-card">
                <div className="meal-card-header">
                  <div className="meal-card-title">
                    <h4 className="meal-name">{mealName}</h4>
                    {hasEntries && (
                      <div className="meal-stats">
                        <span className="meal-calories">{totalCals} kcal</span>
                        <span className="meal-protein">P: {Math.round(totalProtein)}g</span>
                      </div>
                    )}
                  </div>
                  <button
                    className="add-meal-btn"
                    onClick={() => onAdd(mealName)}
                    aria-label={`Add food to ${mealName}`}
                  >
                    ＋
                  </button>
                </div>
                <div className="meal-card-body">
                  {hasEntries ? (
                    <div className="meal-entries">
                      {entries.map((entry) => (
                        <div key={entry.id} className="meal-entry-item">
                          <span className="entry-name">{entry.name}</span>
                          <span className="entry-detail">{entry.detail}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="meal-placeholder">
                      Add what you ate to stay on target
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* More Section */}
      <section className="more-section">
        <h3 className="section-heading">More</h3>
        <div className="more-list">
          <button className="more-item" onClick={onLogs}>
            <div className="more-icon more-icon-water">
              <Icon name="water" size={20} />
            </div>
            <div className="more-content">
              <div className="more-title">Log & water intake</div>
              <div className="more-subtitle">{water} of 8 glasses today</div>
            </div>
            <Icon name="arrow" size={16} />
          </button>
          <button className="more-item" onClick={onHistory}>
            <div className="more-icon more-icon-history">
              <Icon name="trend" size={20} />
            </div>
            <div className="more-content">
              <div className="more-title">Food history</div>
              <div className="more-subtitle">7-day average · 1,947 kcal</div>
            </div>
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

function MacroBar({
  label,
  current,
  target,
  unit
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
}) {
  const percentage = Math.min(100, (current / target) * 100);

  return (
    <div className="macro-row">
      <div className="macro-info">
        <span className="macro-name">{label}</span>
        <span className="macro-values">
          {current} / {target} {unit}
        </span>
      </div>
      <div className="macro-progress">
        <div
          className="macro-progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
