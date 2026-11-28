'use client';
import { useEffect, useState } from 'react';
import AdditionalNutrition from '../Scan/AdditionalNutrition';
import { knownNutrientTotal, nutrientTotal } from '../Scan/nutrientTotal';

import { Icon } from './icons';
import Ring from './Ring';
import CalorieProgress from './CalorieProgress';
import { useActivity } from '../../hooks/useActivity';
import { useNutrition } from '../../hooks/useNutrition';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import { useNotifications } from '../../hooks/useNotifications';
import { useRouter } from 'next/navigation';
import { formatLocalDate } from '../../lib/localDate.mjs';
import type { Profile } from './types';
import { nutritionTargets } from '../Scan/types';
import { planTargets } from '../Scan/DietaryPlan';

export default function HomeDashboard({ profile, onNotify }: {
  profile: Profile;
  onNotify: () => void;
  onAction?: (message: string) => void;
}) {
  const { push: navigate } = useRouter();
  const { activity, dailyMissions, loading: activityLoading, error: activityError, refresh: refreshActivity } = useActivity();
  const { meals, dietaryPlan, loading: nutritionLoading, error: nutritionError, refresh: refreshNutrition } = useNutrition();
  const targets = dietaryPlan ? planTargets(dietaryPlan) : nutritionTargets;
  const macroTargets = { Protein: targets.protein, Carbs: targets.carbs, Fats: targets.fats };
  const { plan, loading: planLoading, error: planError, refresh: refreshPlan } = useCoachPlan();
  const { items: notifications } = useNotifications();
  const unread = notifications.filter(item => item.unread).length;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refreshDate = () => setNow(new Date());
    const timer = window.setInterval(refreshDate, 60_000);
    window.addEventListener('focus', refreshDate);
    document.addEventListener('visibilitychange', refreshDate);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshDate); document.removeEventListener('visibilitychange', refreshDate); };
  }, []);
  const today = formatLocalDate(now);
  const todayIndex = (now.getDay() + 6) % 7;
  const todayPlan = plan?.days.find(day => day.index === todayIndex);
  const todayMeals = meals.filter(meal => meal.date === today);
  const totals = {
    calories: nutrientTotal(todayMeals, item => item.calories),
    Protein: nutrientTotal(todayMeals, item => item.protein),
    Carbs: nutrientTotal(todayMeals, item => item.carbs),
    Fats: nutrientTotal(todayMeals, item => item.fat),
  };
  const knownTotals = {
    calories: knownNutrientTotal(todayMeals, item => item.calories).total,
    Protein: knownNutrientTotal(todayMeals, item => item.protein).total,
    Carbs: knownNutrientTotal(todayMeals, item => item.carbs).total,
    Fats: knownNutrientTotal(todayMeals, item => item.fat).total,
  };
  const incompleteNutrition = Object.values(totals).some(value => value === null);
  const completed = dailyMissions.filter(mission => mission.complete).length;
  const levelPercent = activity.nextLevelExp
    ? Math.min(100, activity.currentExp / activity.nextLevelExp * 100)
    : 0;
  const activityValue = (value: string | number) => activityLoading ? '…' : activityError ? '—' : value;
  const workoutDay = !!todayPlan?.isWorkoutDay && todayPlan.exercises.length > 0;
  const calories = totals.calories ?? knownTotals.calories;
  const partialCalories = totals.calories === null && knownTotals.calories !== null;
  const remaining = calories === null ? null : Math.round(targets.calories - calories);

  return <div className="hm-page hm-dashboard">
    <header className="hm-topbar pq-tab-header">
      <div className="hm-topbar-copy pq-tab-copy">
        <small className="pq-tab-eyebrow" suppressHydrationWarning>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</small>
        <h1 className="pq-tab-title">Hi, {profile.name.trim().split(' ')[0] || 'there'}</h1>
      </div>
      <div className="hm-topbar-actions pq-tab-actions">
        <button type="button" className="hm-icon-btn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={onNotify}><Icon name="bell" size={20} />{unread > 0 && <span className="hm-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}</button>
        <span className="hm-avatar" aria-hidden="true"><img className={profile.photo ? 'user-photo' : undefined} src={profile.photo || '/logo.jpg'} alt="" /></span>
      </div>
    </header>

    <section className="hm-player" aria-label="Activity summary">
      <Ring percent={activityError ? 0 : levelPercent} size={64} stroke={6} tone="violet"><b>{activityValue(activity.level)}</b><small>LEVEL</small></Ring>
      <div className="hm-player-xp">
        <span className="hm-eyebrow">Level progress</span>
        <strong>{activityLoading ? 'Loading…' : activityError ? 'Unavailable' : <>{activity.currentExp.toLocaleString()} <small>/ {activity.nextLevelExp.toLocaleString()} XP</small></>}</strong>
        <div className="hm-bar hm-tone-violet"><span style={{ width: `${activityError ? 0 : levelPercent}%` }}/></div>
      </div>
      <div className="hm-player-stats">
        <span className="hm-chip hm-tone-amber"><Icon name="fire" size={14}/><b>{activityValue(activity.dayStreak)}</b> day streak</span>
        <span className="hm-chip hm-tone-green"><Icon name="star" size={14}/><b>{activityValue(activity.earnedPoints.toLocaleString())}</b> points</span>
      </div>
    </section>

    <section className="hm-hero" aria-label="Today's session">
      <div className="hm-hero-top">
        <span className="hm-eyebrow">{planLoading || planError || !todayPlan || todayPlan.isWorkoutDay ? 'Today’s session' : 'Recovery day'}</span>
        {todayPlan?.isWorkoutDay && <span className="hm-pill"><Icon name="clock" size={13} />{plan?.duration || profile.duration}</span>}
      </div>
      {planError
        ? <p className="hm-inline-error" role="alert">{planError} <button type="button" onClick={() => void refreshPlan()}>Try again</button></p>
        : <h2>{planLoading ? 'Preparing your plan…' : todayPlan?.isWorkoutDay ? todayPlan.title : todayPlan?.title || 'Your plan is ready'}</h2>}
      <ul className="hm-hero-meta">
        <li><Icon name="dumbbell" size={14} />{planLoading ? 'Loading exercises' : planError || !todayPlan ? 'Plan unavailable' : `${todayPlan.exercises.length} exercises`}</li>
        <li><Icon name="target" size={14} />{profile.equipment?.[0] || 'Equipment not set'}</li>
        {workoutDay && <li><Icon name="coach" size={14} />{todayPlan!.exercises.some(exercise => exercise.tracking === 'AI tracked') ? 'AI form tracking' : 'Exercise tracking'}</li>}
      </ul>
      <div className="hm-hero-actions">
        <button type="button" className="hm-btn hm-btn-primary" onClick={() => navigate('/coach')}><Icon name="play" size={14} />{workoutDay ? 'Start workout' : 'View plan'}</button>
        {workoutDay && <button type="button" className="hm-btn hm-btn-ghost" onClick={() => navigate('/coach')}>View full plan</button>}
      </div>
    </section>

    <section className="hm-block" aria-labelledby="hm-missions-title">
      <div className="hm-block-head">
        <h2 id="hm-missions-title">Daily missions {(activityLoading || dailyMissions.length > 0) && <span className="hm-count">{activityLoading ? '…' : `${completed}/${dailyMissions.length}`}</span>}</h2>
        <button type="button" className="hm-link" onClick={() => navigate('/quests')}>View all <Icon name="chevron-right" size={14}/></button>
      </div>
      {activityError ? <p role="alert" className="hm-state">{activityError} <button type="button" onClick={() => void refreshActivity()}>Try again</button></p> : activityLoading ? <p role="status" className="hm-state">Loading your missions…</p> : dailyMissions.length ? <ul className="hm-missions">{dailyMissions.map(mission => <MissionRow key={mission.key} kind={mission.key} title={mission.title} current={mission.progress} total={mission.target} points={mission.points} complete={mission.complete} />)}</ul> : <p className="hm-state">No missions available right now.</p>}
    </section>

    <section className="hm-block" aria-labelledby="hm-nutrition-title">
      <div className="hm-block-head">
        <h2 id="hm-nutrition-title">Nutrition today</h2>
        <button type="button" className="hm-btn hm-btn-soft hm-btn-sm" onClick={() => navigate('/scan')}><Icon name="scan" size={14} />Scan meal</button>
      </div>
      {nutritionError ? <p role="alert" className="hm-state">{nutritionError} <button type="button" onClick={() => void refreshNutrition()}>Try again</button></p> : nutritionLoading ? <p role="status" className="hm-state">Loading your nutrition…</p> : <div className="hm-card hm-nutrition">
        <div className="hm-nutrition-top">
          <CalorieProgress calories={calories} target={targets.calories} partial={partialCalories}/>
          <div className="hm-nutrition-summary">
            <span className="hm-eyebrow">{remaining !== null && remaining < 0 ? 'Over target' : 'Remaining'}</span>
            <strong>{remaining === null ? '—' : Math.abs(remaining).toLocaleString()} <small>kcal</small></strong>
            <p>{todayMeals.length ? `${todayMeals.length} ${todayMeals.length === 1 ? 'item' : 'items'} logged today` : 'Nothing logged yet today'}</p>
          </div>
        </div>
        <div className="hm-macros">
          {(Object.keys(macroTargets) as (keyof typeof macroTargets)[]).map(label => <MacroProgress key={label} label={label} value={totals[label]} known={knownTotals[label]} target={macroTargets[label]} />)}
        </div>
        {incompleteNutrition && <p className="hm-note">Some foods are missing nutrition details. Totals show known values only. <button type="button" onClick={() => navigate('/scan')}>Review meals</button></p>}
        {!dietaryPlan && <p className="hm-note">Using default targets. <button type="button" onClick={() => navigate('/scan/plan')}>Set your dietary plan</button></p>}
        <div className="hm-extra-nutrients"><AdditionalNutrition entries={todayMeals}/></div>
      </div>}
    </section>

    <section className="hm-block" aria-labelledby="hm-journey-title">
      <div className="hm-block-head"><h2 id="hm-journey-title">Your journey</h2></div>
      <div className="hm-tiles">
        <button type="button" className="hm-tile" onClick={() => navigate('/goals')}><span className="hm-tile-icon hm-tone-green"><Icon name="goal-milestones" size={20} /></span><span className="hm-tile-title">Goals &amp; milestones</span><span className="hm-tile-sub">{profile.goal || 'Set up your goal'}{profile.targetWeight ? ` · ${profile.targetWeight} ${profile.weightUnit} target` : ''}</span><span className="hm-tile-go"><Icon name="arrow" size={14} /></span></button>
        <button type="button" className="hm-tile" onClick={() => navigate('/progress')}><span className="hm-tile-icon hm-tone-sky"><Icon name="trend" size={20} /></span><span className="hm-tile-title">Progress</span><span className="hm-tile-sub">Review saved measurements</span><span className="hm-tile-go"><Icon name="arrow" size={14} /></span></button>
      </div>
    </section>
  </div>;
}

const missionTone: Record<string, [string, string]> = { workout: ['dumbbell', 'green'], water: ['water', 'ink'], meals: ['meal', 'sky'] };

function MissionRow({ kind, title, current, total, points, complete }: { kind: string; title: string; current: number; total: number; points: number; complete: boolean }) {
  const percent = total > 0 ? Math.max(0, Math.min(100, current / total * 100)) : 0;
  const [icon, tone] = missionTone[kind] ?? ['trophy', 'violet'];
  return <li className={`hm-mission${complete ? ' is-done' : ''}`}>
    <span role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(total, Math.max(0, current))} aria-valuetext={`${current} of ${total}`}>
      <Ring percent={percent} size={46} stroke={4} tone={tone}><Icon name={complete ? 'check' : icon} size={18}/></Ring>
    </span>
    <span className="hm-mission-copy"><b>{title}</b><small>{current} / {total}{points ? ` · +${points} pts` : ''}</small></span>
    {complete && <span className="hm-pill hm-tone-green">Done</span>}
  </li>;
}

function MacroProgress({ label, value, known, target }: { label: string; value: number | null; known: number | null; target: number }) {
  const shown = value ?? known;
  const tone = label === 'Protein' ? 'green' : label === 'Carbs' ? 'sky' : 'ink';
  if (shown === null) return <div className="hm-macro"><span className="hm-macro-label">{label}</span><b>Unavailable</b></div>;
  const percent = Math.min(100, target > 0 ? shown / target * 100 : 0);
  return <div className="hm-macro">
    <span className="hm-macro-label">{label}</span>
    <b>{Math.round(shown)}<small>{value === null ? ' g' : ` / ${target} g`}</small></b>
    <div className={`hm-bar hm-tone-${tone}`} role="progressbar" aria-label={`${label} intake`} aria-valuemin={0} aria-valuemax={target} {...(value === null ? { 'aria-valuetext': `${Math.round(shown)} grams known; total incomplete` } : { 'aria-valuenow': Math.min(target, Math.round(shown)) })}><span style={{ width: `${percent}%` }} /></div>
  </div>;
}
