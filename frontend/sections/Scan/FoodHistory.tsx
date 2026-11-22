'use client';
import AdditionalNutrition from '../Scan/AdditionalNutrition';
import { titleCase } from '../../lib/titleCase';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FoodEntry } from './types';
import { nutritionTargets as defaultTargets } from './types';
import { Icon } from '../Home/icons';
import { nutrientLabel, nutrientTotal } from './nutrientTotal';
import { summarizeHistory } from './nutritionPresentation';
import { useActivity } from '../../hooks/useActivity';

const ranges = [{ label: '7 days', days: 7 }, { label: '30 days', days: 30 }, { label: '90 days', days: 90 }];
const evidenceLabel = (value?: string) => ({ user_confirmed: 'User confirmed', visually_identified: 'Visually identified', estimated: 'Estimated', unknown: 'Unknown' }[value ?? 'unknown'] ?? 'Unknown');
export default function FoodHistory({ meals, onBack, targets: nutritionTargets = defaultTargets, previousCalorieTarget = null, backLabel = 'Back to Nutrition' }: { meals: FoodEntry[]; onBack: () => void; targets?: typeof defaultTargets; previousCalorieTarget?: number | null; backLabel?: string }) {
  const [range, setRange] = useState(ranges[0]);
  const [openedDate, setOpenedDate] = useState<string | null>(null);
  const [today, setToday] = useState(() => new Date());
  const { activity, loading: accountLoading } = useActivity();
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const next = new Date(today); next.setHours(24, 0, 0, 100);
    const timer = window.setTimeout(() => setToday(new Date()), Math.max(1, next.getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [today]);
  const accountDate = activity.accountCreatedAt ? new Date(activity.accountCreatedAt) : null;
  const validAccountDate = accountDate && Number.isFinite(accountDate.getTime()) && accountDate.getTime() <= today.getTime() ? activity.accountCreatedAt : null;
  const summary = useMemo(() => summarizeHistory(meals, range.days, today, range.days === 90 ? validAccountDate : undefined), [meals, range, today, validAccountDate]);
  const visibleMeals = summary.visible.filter(entry => !!entry.date);
  useEffect(() => { if (chartRef.current) chartRef.current.scrollLeft = chartRef.current.scrollWidth; }, [range, visibleMeals.length]);
  const days = summary.daily;
  const chartWidth = days.length > 30 ? days.length * 10 : days.length > 7 ? days.length * 16 : 0;
  const chartEntries = days;
  const maxCalories = Math.max(nutritionTargets.calories, previousCalorieTarget ?? 0, ...chartEntries.flatMap(entry => entry.calories === null ? [] : [entry.calories])) * 1.08;
  const loggedCalories = nutrientTotal(visibleMeals, entry => entry.calories);
  const records = days.filter(day => day.count > 0).slice().reverse();
  const difference = summary.average === null ? null : nutritionTargets.calories - summary.average;
  return <div className="food-history-screen">
    <header className="scan-header add-food-header pq-page-heading"><button type="button" className="coach-back" onClick={onBack} aria-label={backLabel}><Icon name="arrow" size={20}/></button><h2>Food history</h2></header>
    <div className="history-tabs" role="group" aria-label="History period">{ranges.map(item => <button type="button" key={item.label} className={range.label === item.label ? 'active' : ''} aria-pressed={range.label === item.label} onClick={() => { setRange(item); setOpenedDate(null); }}>{item.label}</button>)}</div>
    {range.days === 90 && accountLoading ? <p className="history-chart-note" role="status">Loading account history…</p> : visibleMeals.length === 0 ? <section className="history-records"><h3>No meals saved</h3><p>Meals you log will appear here.{range.days === 90 && !validAccountDate ? ' Account creation date unavailable; showing up to 90 days.' : ''}</p></section> : <>
      <section className="history-summary" aria-label="Intake summary">
        <div className="history-summary-head"><span className="history-summary-icon"><Icon name="chart-bars" size={20}/></span><div><h3>Average daily intake</h3><p>Based on {records.length} {records.length === 1 ? 'day' : 'days'} with saved meals</p></div></div>
        <div className="history-total"><b>{summary.average?.toLocaleString() ?? 'Incomplete'}</b> {summary.average !== null && <span>kcal / day</span>}</div>
        {difference !== null && <p className="history-comparison">{Math.abs(difference).toLocaleString()} kcal {difference >= 0 ? 'below' : 'above'} your {nutritionTargets.calories.toLocaleString()} kcal target</p>}
        <p className="history-summary-note">Logged meals may not represent everything you ate.</p>
      </section>
      <section className="history-chart-section" aria-labelledby="history-chart-title"><div className="history-section-heading"><h3 id="history-chart-title">Daily calories</h3><span>Target {nutritionTargets.calories.toLocaleString()} kcal</span></div>
      <p className="history-chart-note">{range.days === 90 && days.length > 0 ? `${new Date(`${days[0].date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(`${days[days.length - 1].date}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}. ` : ''}{days.length > 7 ? 'Swipe to view all days. ' : ''}Days without meals are blank.{range.days === 90 && !validAccountDate ? ' Account creation date unavailable; showing up to 90 days.' : ''}</p>
      <div className="history-chart-key"><span><i className="history-key-target"/>Current target: {nutritionTargets.calories.toLocaleString()} kcal</span><span><i className="history-key-logged"/>Logged: {nutrientLabel(loggedCalories, 'kcal')}</span><span>{previousCalorieTarget !== null && <i className="history-key-previous"/>}{previousCalorieTarget === null ? 'Previous target: unavailable' : `Previous target: ${previousCalorieTarget.toLocaleString()} kcal`}</span></div>
      {previousCalorieTarget !== null && <p className="history-chart-note">The previous target is a reference, not a timeline of past targets.</p>}
      <div className="history-chart-layout"><div className="history-y-axis" aria-hidden="true"><span>{Math.round(maxCalories).toLocaleString()}</span><span>{Math.round(maxCalories / 2).toLocaleString()}</span><span>0</span></div>
      <div ref={chartRef} className="history-chart-scroll" tabIndex={0} role="region" aria-label="Daily calorie chart; scroll to see all days">
      <div className="history-chart" style={{ minWidth: chartWidth }} role="img" aria-label={`Calories by date, vertical axis from 0 to ${Math.round(maxCalories)} kilocalories. Daily target ${nutritionTargets.calories} kcal. ${previousCalorieTarget === null ? 'Previous target unavailable.' : `Previous target ${previousCalorieTarget} kcal, shown as a dashed reference line.`} Days without saved meals are blank.`}>
        <div className="history-target-line" style={{ bottom: `${nutritionTargets.calories / maxCalories * 100}%` }}><span>Target</span></div>
        {previousCalorieTarget !== null && <div className="history-previous-target-line" style={{ bottom: `${previousCalorieTarget / maxCalories * 100}%` }} aria-hidden="true"/>}
        {chartEntries.map(({ date, calories }, index) => <div className="history-chart-column" key={date} title={`${date}: ${nutrientLabel(calories, 'kcal')}`}><i className={calories !== null && calories > nutritionTargets.calories ? 'over' : index === chartEntries.length - 1 ? 'latest' : ''} style={{ height: `${calories ? Math.max(4, calories / maxCalories * 100) : 0}%` }}/>{(days.length <= 7 || index % (days.length <= 30 ? 6 : 18) === 0 || index === days.length - 1) && <small>{days.length <= 7 ? ['Su', 'M', 'T', 'W', 'Th', 'F', 'S'][new Date(`${date}T12:00:00`).getDay()] : new Date(`${date}T12:00:00`).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</small>}</div>)}
      </div></div></div></section>
      <section className="history-macros"><h3>Average macro split</h3>{(['protein', 'carbs', 'fat'] as const).map(key => <div className="history-macro" key={key}><div><span>{key === 'fat' ? 'Fat' : key[0].toUpperCase() + key.slice(1)}</span><b>{summary.split[key] === null ? nutrientLabel(summary.grams[key], 'g total') : summary.split[key] + '%'}</b></div><div className="history-macro-track"><span style={{ width: summary.split[key] === null ? '0%' : summary.split[key] + '%' }}/></div></div>)}</section>
      <AdditionalNutrition entries={visibleMeals}/>
      <section className="history-records"><div className="history-section-heading"><h3>Meal records</h3><span>{records.length} {records.length === 1 ? 'day' : 'days'}</span></div>{records.map(day => <div className="history-record-group" key={day.date}><button type="button" className="history-entry" aria-expanded={openedDate === day.date} onClick={() => setOpenedDate(current => current === day.date ? null : day.date)}><span><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</b><small>{day.count} {day.count === 1 ? 'food' : 'foods'} logged</small></span><strong>{nutrientLabel(day.calories, 'kcal')}</strong><Icon name={openedDate === day.date ? 'chevron-down' : 'chevron-right'} size={16}/></button>{openedDate === day.date && <ul className="history-record-details">{visibleMeals.filter(entry => entry.date === day.date).map(entry => <li key={entry.id}><span>{entry.meal} · {titleCase(entry.name)}<small>{[entry.source, entry.detail, entry.time].filter(Boolean).join(' · ')}<br/>Protein {nutrientLabel(entry.protein, 'g')} · Carbs {nutrientLabel(entry.carbs, 'g')} · Fat {nutrientLabel(entry.fat, 'g')}{entry.estWeightG != null && ' · ' + entry.estWeightG + ' g'}{entry.foodEvidence && <><br/>Food: {evidenceLabel(entry.foodEvidence.name)} · Quantity: {evidenceLabel(entry.foodEvidence.quantity)}<br/>Preparation: {entry.preparation || 'Not specified'} ({evidenceLabel(entry.foodEvidence.preparation)}) · Added oil or fat: {entry.addedOil || 'Not specified'} ({evidenceLabel(entry.foodEvidence.added_oil)})</>}</small></span><b>{nutrientLabel(entry.calories, 'kcal')}</b></li>)}</ul>}</div>)}</section>
    </>}
  </div>;
}
