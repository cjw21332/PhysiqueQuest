'use client';

import { Icon } from './icons';
import CalorieProgress from './CalorieProgress';
import { useActivity } from '../../hooks/useActivity';
import { useNutrition } from '../../hooks/useNutrition';
import { useCoachPlan } from '../../hooks/useCoachPlan';
import { navigate } from '../../lib/navigation';
import { formatLocalDate } from '../../lib/localDate.mjs';
import type { Profile } from './types';
import { nutritionTargets } from '../Scan/types';

const macroTargets = {
  Protein: nutritionTargets.protein,
  Carbs: nutritionTargets.carbs,
  Fats: nutritionTargets.fats,
} as const;

export default function HomeDashboard({ profile, onNotify }: {
  profile: Profile;
  onNotify: () => void;
  onAction?: (message: string) => void;
}) {
  const { activity, dailyMissions, loading: activityLoading, error: activityError } = useActivity();
  const { meals, water, loading: nutritionLoading, error: nutritionError } = useNutrition();
  const { plan, loading: planLoading, error: planError } = useCoachPlan();
  const now = new Date();
  const today = formatLocalDate(now);
  const todayIndex = (now.getDay() + 6) % 7;
  const todayPlan = plan?.days[todayIndex];
  const todayMeals = meals.filter(meal => meal.date === today);
  const totals = {
    calories: todayMeals.reduce((sum, meal) => sum + meal.calories, 0),
    Protein: todayMeals.reduce((sum, meal) => sum + meal.protein, 0),
    Carbs: todayMeals.reduce((sum, meal) => sum + meal.carbs, 0),
    Fats: todayMeals.reduce((sum, meal) => sum + meal.fat, 0),
  };
  const completed = dailyMissions.filter(mission => mission.complete).length;
  const levelPercent = activity.nextLevelExp
    ? Math.min(100, activity.currentExp / activity.nextLevelExp * 100)
    : 0;
  const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return <div className="dashboard-container home-ref-dashboard">
    <header className="dashboard-header home-ref-header">
      <div className="user-greeting">
        <div className="avatar-badge" aria-hidden="true">{initials || <Icon name="user" size={20} />}</div>
        <div className="greeting-text">
          <small className="greeting-meta">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</small>
          <h1 className="greeting-name">Hi, {profile.name.trim().split(' ')[0] || 'there'}</h1>
        </div>
      </div>
      <button className="notification-bell" aria-label="Notifications" onClick={onNotify}><Icon name="bell" size={20} /></button>
    </header>

    <section className="workout-card home-ref-workout" aria-label="Today's session">
      <div className="home-ref-session-top">
        <small className="workout-label">{planLoading ? 'Today’s session' : todayPlan?.isWorkoutDay ? 'Today’s session' : 'Recovery day'}</small>
        {todayPlan?.isWorkoutDay && <span className="workout-duration"><Icon name="clock" size={13} />{plan?.duration || profile.duration}</span>}
      </div>
      {planError
        ? <p className="home-ref-inline-error" role="alert">{planError}</p>
        : <h2 className="workout-title">{planLoading ? 'Preparing your plan…' : todayPlan?.isWorkoutDay ? todayPlan.title : todayPlan?.title || 'Your plan is ready'}</h2>}
      <div className="home-ref-session-meta">
        <span><Icon name="dumbbell" size={13} />{planLoading ? 'Loading exercises' : `${todayPlan?.exercises.length ?? 0} exercises`}</span>
        <span>{profile.equipment?.[0] || 'Equipment not set'}</span>
        {todayPlan?.isWorkoutDay && <span><Icon name="coach" size={13} />{todayPlan.exercises.some(exercise => exercise.tracking === 'AI tracked') ? 'AI form tracking' : 'Exercise tracking'}</span>}
      </div>
      <button className="start-button" onClick={() => navigate('/coach')}><Icon name="play" size={14} />Start workout</button>
      <button className="link-text" onClick={() => navigate('/coach')}>View full plan</button>
    </section>

    <section className="stats-row home-ref-stats" aria-label="Activity summary">
      <div className="stat-box"><div className="stat-number">{activityLoading ? '…' : activity.dayStreak}</div><div className="stat-text">day streak</div></div>
      <div className="stat-separator" />
      <div className="stat-box"><div className="stat-number">{activityLoading ? '…' : activity.earnedPoints.toLocaleString()}</div><div className="stat-text">points</div></div>
      <div className="stat-separator" />
      <div className="stat-box stat-level-box"><div className="stat-number">Lv {activityLoading ? '…' : activity.level}</div><div className="level-bar-container"><div className="level-bar-fill" style={{ width: `${levelPercent}%` }} /></div></div>
    </section>

    <section className="content-section home-ref-section">
      <div className="section-title-row"><h3 className="section-title">Daily missions · {activityLoading ? '…' : `${completed} of ${dailyMissions.length}`}</h3><button className="view-all-link" onClick={() => navigate('/quests')}>View all</button></div>
      {activityError ? <p role="alert" className="error">{activityError}</p> : activityLoading ? <p role="status">Loading your missions…</p> : dailyMissions.length ? <div className="missions-container">{dailyMissions.map(mission => <MissionCard key={mission.key} title={mission.title} current={mission.progress} total={mission.target} />)}</div> : <p>No missions available right now.</p>}
    </section>

    <section className="content-section home-ref-section">
      <div className="section-title-row"><h3 className="section-title">Nutrition today</h3><button className="scan-link" onClick={() => navigate('/scan')}><Icon name="scan" size={12} />Scan meal</button></div>
      {nutritionError ? <p role="alert" className="error">{nutritionError}</p> : nutritionLoading ? <p role="status">Loading your nutrition…</p> : <div className="nutrition-overview home-ref-nutrition">
        <CalorieProgress calories={totals.calories} target={nutritionTargets.calories}/>
        <div className="macros-list">
          {(Object.keys(macroTargets) as (keyof typeof macroTargets)[]).map(label => <MacroProgress key={label} label={label} value={totals[label]} target={macroTargets[label]} />)}
        </div>
      </div>}
    </section>

    <section className="content-section home-ref-section home-ref-journey">
      <h3 className="section-title">Your journey</h3>
      <div className="journey-cards">
        <button className="journey-card" onClick={() => navigate('/goals')}><div className="journey-icon journey-icon-goals"><Icon name="target" size={18} /></div><div className="journey-info"><div className="journey-title">Goals &amp; milestones</div><div className="journey-subtitle">{profile.goal || 'Set up your goal'}{profile.targetWeight ? ` · ${profile.targetWeight} ${profile.weightUnit} target` : ''}</div></div><Icon name="arrow" size={14} /></button>
        <button className="journey-card" onClick={() => navigate('/progress')}><div className="journey-icon journey-icon-progress"><Icon name="trend" size={18} /></div><div className="journey-info"><div className="journey-title">Progress</div><div className="journey-subtitle">Review saved measurements</div></div><Icon name="arrow" size={14} /></button>
      </div>
    </section>
  </div>;
}

function MissionCard({ title, current, total }: { title: string; current: number; total: number }) {
  const percent = total > 0 ? Math.min(100, current / total * 100) : 0;
  return <div className="mission-card"><div className="mission-header"><span className="mission-title">{title}</span><span className="mission-count">{current} / {total}</span></div><div className="mission-bar" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}><div className="mission-bar-fill" style={{ width: `${percent}%` }} /></div></div>;
}

function MacroProgress({ label, value, target }: { label: string; value: number; target: number }) {
  const percent = Math.min(100, target > 0 ? value / target * 100 : 0);
  return <div className="macro-item">
    <div className="macro-header"><span className="macro-label">{label}</span><span className="macro-values">{Math.round(value)} / {target} g</span></div>
    <div className="macro-bar" role="progressbar" aria-label={`${label} intake`} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(target, Math.round(value))}><div className="macro-bar-fill" style={{ width: `${percent}%` }} /></div>
  </div>;
}
