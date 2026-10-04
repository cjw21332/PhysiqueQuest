'use client';

import { useMemo, useState } from 'react';
import type { FoodEntry } from './types';
import { Icon } from '../Home/icons';
import { formatLocalDate } from '../../lib/localDate.mjs';

const ranges = [{ label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }];

export default function FoodHistory({ meals, onBack }: { meals: FoodEntry[]; onBack: () => void }) {
  const [range, setRange] = useState(ranges[0]);
  const days = useMemo(() => Array.from({ length: range.days }, (_, i) => {
    const date = new Date(); date.setDate(date.getDate() - (range.days - i - 1));
    return formatLocalDate(date);
  }), [range]);
  const visibleMeals = meals.filter(entry => !!entry.date && days.includes(entry.date));
  const byDate = new Map(days.map(date => [date, visibleMeals.filter(entry => entry.date === date).reduce((sum, entry) => sum + entry.calories, 0)]));
  const loggedDays = [...byDate.values()].filter(value => value > 0);
  const average = loggedDays.length ? Math.round(loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length) : 0;
  const totals = visibleMeals.reduce((sum, item) => ({ protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { protein: 0, carbs: 0, fat: 0 });
  const macroTotal = totals.protein + totals.carbs + totals.fat;
  const chartEntries = days.filter((_, index) => range.days <= 7 || index % (range.days <= 30 ? 3 : 9) === 0 || index === days.length - 1).map(date => ({ date, calories: byDate.get(date) ?? 0 }));
  const maxCalories = Math.max(1, ...chartEntries.map(entry => entry.calories));
  const caption = range.days === 7 ? 'Daily calories' : 'Calories by date';
  return <><header className="scan-header add-food-header"><button className="coach-back" onClick={onBack} aria-label="Back"><Icon name="arrow" size={24}/></button><h2>Food history</h2></header>
    <div className="history-tabs">{ranges.map(item => <button key={item.label} className={range.label === item.label ? 'active' : ''} aria-pressed={range.label === item.label} onClick={() => setRange(item)}>{item.label}</button>)}</div>
    {visibleMeals.length === 0 ? <section className="history-records"><h3>No meals saved</h3><p>Meals you log will appear here.</p></section> : <>
      <small className="history-caption">Average per day with saved meals</small><div className="history-total"><b>{average.toLocaleString()}</b> kcal</div>
      <div className="history-chart" aria-label={caption}>{chartEntries.map(({ date, calories }) => <div key={date} title={`${date}: ${calories} kcal`}><i className={calories > 0 ? 'latest' : ''} style={{ height: `${calories ? Math.max(4, calories / maxCalories * 100) : 0}%` }}/><small>{new Date(`${date}T12:00:00`).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</small></div>)}</div>
      {macroTotal > 0 && <section className="history-macros"><h3>Saved macro totals</h3>{(['protein', 'carbs', 'fat'] as const).map(key => <div className="history-macro" key={key}><div><span>{key === 'fat' ? 'Fat' : key[0].toUpperCase() + key.slice(1)}</span><b>{Math.round(totals[key])} g</b></div></div>)}</section>}
      <section className="history-records"><h3>Records</h3>{visibleMeals.slice().sort((a,b) => (b.date ?? '').localeCompare(a.date ?? '') || b.time.localeCompare(a.time)).map(entry => <div className="history-entry" key={entry.id}><span><b>{entry.meal} · {entry.name}</b><small>{entry.date} · {entry.source} · {entry.time}</small></span><strong>{entry.calories.toFixed(1)} kcal</strong></div>)}</section>
    </>}
  </>;
}
