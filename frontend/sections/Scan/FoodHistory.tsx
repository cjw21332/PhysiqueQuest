'use client';

import { useMemo, useState } from 'react';
import type { FoodEntry } from './types';
import { useNutritionTargets } from '../../hooks/useNutritionTargets';
import { Icon } from '../Home/icons';
import { summarizeHistory } from './nutritionPresentation';

const ranges = [{ label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }];
export default function FoodHistory({ meals, onBack, backLabel = 'Back to Nutrition' }: { meals: FoodEntry[]; onBack: () => void; backLabel?: string }) {
  const nutritionTargets = useNutritionTargets();
  const [range, setRange] = useState(ranges[0]);
  const [openedDate, setOpenedDate] = useState<string | null>(null);
  const summary = useMemo(() => summarizeHistory(meals, range.days), [meals, range]);
  const visibleMeals = summary.visible.filter(entry => !!entry.date);
  const days = summary.daily;
  const chartEntries = days.filter((_, index) => range.days <= 7 || index % (range.days <= 30 ? 3 : 9) === 0 || index === days.length - 1);
  const maxCalories = Math.max(nutritionTargets.calories, ...chartEntries.map(entry => entry.calories)) * 1.08;
  const records = days.filter(day => day.calories > 0).slice().reverse();
  const difference = nutritionTargets.calories - summary.average;
  return <div className="food-history-screen">
    <header className="scan-header add-food-header"><button className="coach-back" onClick={onBack} aria-label={backLabel}><Icon name="arrow" size={20}/></button><h2>Food history</h2></header>
    <div className="history-tabs" role="group" aria-label="History period">{ranges.map(item => <button key={item.label} className={range.label === item.label ? 'active' : ''} aria-pressed={range.label === item.label} onClick={() => { setRange(item); setOpenedDate(null); }}>{item.label}</button>)}</div>
    {visibleMeals.length === 0 ? <section className="history-records"><h3>No meals saved</h3><p>Meals you log will appear here.</p></section> : <>
      <small className="history-caption" title="Average over days with saved meals">Average daily intake</small><div className="history-total"><b>{summary.average.toLocaleString()}</b> <span>kcal</span></div>
      <p className={`history-target-note ${difference < 0 ? 'over-target' : ''}`}>{Math.abs(difference).toLocaleString()} kcal {difference >= 0 ? 'under' : 'over'} your {nutritionTargets.calories.toLocaleString()} target</p>
      <div className="history-chart" role="img" aria-label={`Calories by date. Daily target ${nutritionTargets.calories} kcal`}>
        <div className="history-target-line" style={{ bottom: `${nutritionTargets.calories / maxCalories * 100}%` }}><span>Target</span></div>
        {chartEntries.map(({ date, calories }, index) => <div className="history-chart-column" key={date} title={`${date}: ${calories} kcal`}><i className={calories > nutritionTargets.calories ? 'over' : index === chartEntries.length - 1 ? 'latest' : ''} style={{ height: `${calories ? Math.max(4, calories / maxCalories * 100) : 0}%` }}/><small>{range.days === 7 ? ['Su', 'M', 'T', 'W', 'Th', 'F', 'S'][new Date(`${date}T12:00:00`).getDay()] : new Date(`${date}T12:00:00`).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</small></div>)}
      </div>
      <section className="history-macros"><h3>Average macro split</h3>{(['protein', 'carbs', 'fat'] as const).map(key => <div className="history-macro" key={key}><div><span>{key === 'fat' ? 'Fat' : key[0].toUpperCase() + key.slice(1)}</span><b>{summary.split[key]}%</b></div><div className="history-macro-track"><span style={{ width: `${summary.split[key]}%` }}/></div></div>)}</section>
      <section className="history-records"><h3>Records</h3>{records.map(day => <div className="history-record-group" key={day.date}><button type="button" className="history-entry" aria-expanded={openedDate === day.date} onClick={() => setOpenedDate(current => current === day.date ? null : day.date)}><span><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</b><small>{visibleMeals.filter(entry => entry.date === day.date).length} logged meals</small></span><strong>{Math.round(day.calories).toLocaleString()} kcal</strong><Icon name="arrow" size={16}/></button>{openedDate === day.date && <ul className="history-record-details">{visibleMeals.filter(entry => entry.date === day.date).map(entry => <li key={entry.id}><span>{entry.meal} · {entry.name}<small>{entry.source} · {entry.time}</small></span><b>{Math.round(entry.calories)} kcal</b></li>)}</ul>}</div>)}</section>
    </>}
  </div>;
}
