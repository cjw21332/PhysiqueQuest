'use client';

import { Icon } from './icons';
import { useActivity } from '../../hooks/useActivity';
import { useNutrition } from '../../hooks/useNutrition';
import { navigate } from '../../lib/navigation';
import { formatLocalDate } from '../../lib/localDate.mjs';

type Profile = { name?: string; email?: string; [key: string]: any };

export default function HomeDashboard({ profile, onOpen, onNotify }: {
  profile: Profile;
  onOpen: (screen: 'goals' | 'progress') => void;
  onNotify: () => void;
  onAction?: (message: string) => void;
}) {
  const { activity, dailyMissions, loading: activityLoading, error: activityError } = useActivity();
  const { meals, loading: nutritionLoading, error: nutritionError } = useNutrition();
  const now = new Date();
  const today = formatLocalDate(now);
  const todayMeals = meals.filter(meal => meal.date === today);
  const calories = todayMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const macros = [
    ['Protein', todayMeals.reduce((sum, meal) => sum + meal.protein, 0)],
    ['Carbs', todayMeals.reduce((sum, meal) => sum + meal.carbs, 0)],
    ['Fats', todayMeals.reduce((sum, meal) => sum + meal.fat, 0)],
  ] as const;
  const completed = dailyMissions.filter(mission => mission.complete).length;

  return <div className="dashboard-container">
    <header className="dashboard-header">
      <div className="user-greeting"><div className="avatar-badge"><Icon name="user" size={20} /></div>
        <div className="greeting-text"><small className="greeting-meta">{now.toLocaleDateString('en-US', { weekday: 'long' })}</small><h1 className="greeting-name">Hi, {profile.name?.trim().split(' ')[0] || 'there'}</h1></div>
      </div>
      <button className="notification-bell" aria-label="Notifications" onClick={onNotify}><Icon name="bell" size={20} /></button>
    </header>

    <section className="workout-card">
      <div className="workout-header"><small className="workout-label">Workout</small></div>
      <h2 className="workout-title">Ready when you are</h2>
      <div className="workout-meta"><span className="workout-detail">Start a workout and track its duration</span></div>
      <button className="start-button" onClick={() => navigate('/coach')}><Icon name="play" size={14} />Start workout</button>
      <button className="link-text" onClick={() => onOpen('progress')}>View progress</button>
    </section>

    <section className="stats-row" aria-label="Activity summary">
      <div className="stat-box"><div className="stat-icon stat-icon-fire"><Icon name="fire" size={14} /></div><div className="stat-number">{activityLoading ? '…' : activity.dayStreak}</div><div className="stat-text">day streak</div></div>
      <div className="stat-separator" />
      <div className="stat-box"><div className="stat-number">{activityLoading ? '…' : activity.earnedPoints.toLocaleString()}</div><div className="stat-text">points</div></div>
      <div className="stat-separator" />
      <div className="stat-box stat-level-box"><div className="stat-number">Lv {activityLoading ? '…' : activity.level}</div><div className="level-bar-container"><div className="level-bar-fill" style={{ width: `${activity.nextLevelExp ? Math.min(100, activity.currentExp / activity.nextLevelExp * 100) : 0}%` }} /></div><div className="stat-text">Level</div></div>
    </section>

    <section className="content-section">
      <div className="section-title-row"><h3 className="section-title">Daily missions · {completed} of {dailyMissions.length}</h3><button className="view-all-link" onClick={() => onOpen('progress')}>View all</button></div>
      {activityError ? <p role="alert" className="error">{activityError}</p> : activityLoading ? <p role="status">Loading your missions…</p> : dailyMissions.length ? <div className="missions-container">{dailyMissions.map(mission => <MissionCard key={mission.key} title={mission.title} current={mission.progress} total={mission.target} />)}</div> : <p>No missions available right now.</p>}
    </section>

    <section className="content-section">
      <div className="section-title-row"><h3 className="section-title">Nutrition today</h3><button className="scan-link" onClick={() => navigate('/scan')}><Icon name="scan" size={12} />Scan meal</button></div>
      {nutritionError ? <p role="alert" className="error">{nutritionError}</p> : nutritionLoading ? <p role="status">Loading your nutrition…</p> : <div className="nutrition-overview"><div className="calorie-circle"><svg className="circle-svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" className="circle-bg" /></svg><div className="circle-content"><div className="calorie-amount">{calories.toLocaleString()}</div><div className="calorie-goal">kcal logged</div></div></div><div className="macros-list">{macros.map(([label, value]) => <MacroProgress key={label} label={label} value={Math.round(value)} />)}</div></div>}
    </section>

    <section className="content-section"><h3 className="section-title">Your journey</h3><div className="journey-cards">
      <button className="journey-card" onClick={() => onOpen('goals')}><div className="journey-icon journey-icon-goals"><Icon name="target" size={18} /></div><div className="journey-info"><div className="journey-title">Goals &amp; milestones</div><div className="journey-subtitle">{profile.goal || 'Set up your goal'}</div></div><Icon name="arrow" size={14} /></button>
      <button className="journey-card" onClick={() => onOpen('progress')}><div className="journey-icon journey-icon-progress"><Icon name="trend" size={18} /></div><div className="journey-info"><div className="journey-title">Progress</div><div className="journey-subtitle">View your saved measurements</div></div><Icon name="arrow" size={14} /></button>
    </div></section>
  </div>;
}

function MissionCard({ title, current, total }: { title: string; current: number; total: number }) {
  const percent = total > 0 ? Math.min(100, current / total * 100) : 0;
  return <div className="mission-card"><div className="mission-header"><span className="mission-title">{title}</span><span className="mission-count">{current} / {total}</span></div><div className="mission-bar"><div className="mission-bar-fill" style={{ width: `${percent}%` }} /></div></div>;
}

function MacroProgress({ label, value }: { label: string; value: number }) {
  return <div className="macro-item"><div className="macro-header"><span className="macro-label">{label}</span><span className="macro-values">{value} g logged</span></div></div>;
}
