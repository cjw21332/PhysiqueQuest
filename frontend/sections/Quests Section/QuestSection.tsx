'use client';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import BottomNav from '../Home/BottomNav';
import type { Profile } from '../Home/types';
import { useActivity } from '../../hooks/useActivity';
import { useSettings } from '../../hooks/useSettings';

type LeaderboardPeriod = 'week' | 'month' | 'all';
type LeaderboardEntry = { name: string; points: number; movement: number | 'same' };
type Screen = 'quests' | 'leaderboard';

// Preview rankings follow the supplied UI while the ranking API is being prepared.
const leaderboardEntries: Record<LeaderboardPeriod, LeaderboardEntry[]> = {
  week: [
    { name: 'Levi M.', points: 4210, movement: 'same' },
    { name: 'Charles W.', points: 3980, movement: 2 },
    { name: 'Michael A.', points: 3650, movement: 1 },
    { name: 'Rico M.', points: 3120, movement: 2 },
    { name: 'Angel P.', points: 2980, movement: 1 },
    { name: 'Karl D.', points: 2760, movement: -4 },
    { name: 'Bea S.', points: 2540, movement: 'same' },
  ],
  month: [
    { name: 'Charles W.', points: 18420, movement: 3 },
    { name: 'Levi M.', points: 17650, movement: -1 },
    { name: 'Michael A.', points: 15980, movement: 2 },
    { name: 'Rico M.', points: 14720, movement: 1 },
    { name: 'Angel P.', points: 13980, movement: 'same' },
    { name: 'Bea S.', points: 12640, movement: 4 },
    { name: 'Karl D.', points: 11920, movement: -2 },
  ],
  all: [
    { name: 'Michael A.', points: 68420, movement: 1 },
    { name: 'Charles W.', points: 65210, movement: 'same' },
    { name: 'Levi M.', points: 61780, movement: 2 },
    { name: 'Angel P.', points: 58320, movement: 1 },
    { name: 'Rico M.', points: 56740, movement: -2 },
    { name: 'Karl D.', points: 52490, movement: 3 },
    { name: 'Bea S.', points: 49810, movement: -1 },
  ],
};

const periodLabels: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

function formatPoints(points: number) {
  return new Intl.NumberFormat('en-US').format(points);
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');
}

export default function QuestSection({ profile, onLogoutRequest: _onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const { activity, dailyMissions, badges, loading, error, refresh } = useActivity();
  const { settings } = useSettings();
  const [screen, setScreen] = useState<Screen>('quests');
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const level = activity.level;
  const currentExp = activity.currentExp;
  const nextLevelExp = activity.nextLevelExp;
  const expProgress = nextLevelExp ? Math.min(currentExp / nextLevelExp * 100, 100) : 0;

  if (loading) return <section className="quest-section"><div className="profile-load-state" role="status"><h2>Loading quests…</h2></div><BottomNav /></section>;
  if (error) return <section className="quest-section"><div className="profile-load-state" role="alert"><h2>Could not load quests</h2><p>{error}</p><button onClick={() => void refresh()}>Try again</button></div><BottomNav /></section>;

  if (screen === 'leaderboard') {
    const entries = leaderboardEntries[period];
    const podium = [entries[1], entries[0], entries[2]];
    const currentName = profile.name.trim() || 'You';
    return <section className="quest-section leaderboard-screen" aria-label="Leaderboard">
      <header className="leaderboard-header">
        <button className="leaderboard-back" type="button" onClick={() => setScreen('quests')} aria-label="Back to quests"><Icon name="arrow" size={19}/></button>
        <h2>Leaderboard</h2>
      </header>
      <div className="leaderboard-scroll">
        <div className="leaderboard-periods" role="tablist" aria-label="Leaderboard period">
          {periodLabels.map(option => <button key={option.key} type="button" role="tab" aria-selected={period === option.key} aria-pressed={period === option.key} className={period === option.key ? 'selected' : ''} onClick={() => setPeriod(option.key)}>{option.label}</button>)}
        </div>
        <section className="leaderboard-podium" aria-label="Top three players">
          {podium.map((entry, index) => {
            const rank = index === 0 ? 2 : index === 1 ? 1 : 3;
            return <div className={`podium-player podium-rank-${rank}`} key={entry.name}>
              {rank === 1 && <Icon name="crown" size={19}/>}
              <div className="podium-avatar">{getInitials(entry.name)}</div>
              <strong>{entry.name}</strong>
              <small>{formatPoints(entry.points)} pts</small>
              <div className="podium-step">{rank}</div>
            </div>;
          })}
        </section>
        <div className="leaderboard-rankings" role="list" aria-label="Leaderboard rankings">
          {entries.slice(3).map((entry, index) => {
            const rank = index + 4;
            return <div className="leaderboard-row" role="listitem" key={entry.name}>
              <span className="leaderboard-rank">{rank}</span>
              <span className="leaderboard-avatar">{getInitials(entry.name)}</span>
              <span className="leaderboard-person"><strong>{entry.name}</strong><small>{formatPoints(entry.points)} pts</small></span>
              <span className={`leaderboard-movement ${typeof entry.movement === 'number' ? (entry.movement > 0 ? 'up' : 'down') : 'same'}`} aria-label={typeof entry.movement === 'number' ? `${Math.abs(entry.movement)} places ${entry.movement > 0 ? 'up' : 'down'}` : 'No rank change'}>
                {typeof entry.movement === 'number' ? <>{entry.movement > 0 ? '↑' : '↓'} {Math.abs(entry.movement)}</> : '—'}
              </span>
            </div>;
          })}
        </div>
        {settings.showLeaderboard ? <>
          <div className="leaderboard-self-row" aria-label={`Your rank, 14, ${currentName}`}>
            <span className="leaderboard-rank">14</span>
            <span className="leaderboard-self-avatar">{getInitials(currentName)}</span>
            <span className="leaderboard-person"><strong>You · {currentName}</strong><small>1,840 pts · {activity.dayStreak}-day streak</small></span>
            <span className="leaderboard-movement up" aria-label="3 places up">↑ 3</span>
          </div>
          <p className="leaderboard-context">1,280 pts behind rank 7 — two workouts closes most of it.</p>
        </> : <p className="leaderboard-context" role="status">Your ranking is hidden. Turn on leaderboard visibility in privacy settings to show your profile.</p>}
        <p className="leaderboard-preview-note">Sample rankings shown for preview. Your activity, streak, and leaderboard privacy setting are live.</p>
      </div>
      <BottomNav />
    </section>;
  }

  return <section className="quest-section" aria-label="Quests">
    <header className="quest-v2-header"><h2>Quests</h2><button className="quest-v2-leaderboard-link" type="button" onClick={() => setScreen('leaderboard')}><Icon name="trophy" size={14}/>Leaderboard</button></header>
    <div className="quest-v2-scroll">
      <section className="quest-v2-level-card" aria-label={`Level ${level}, ${activity.dayStreak} day streak`}>
        <div className="quest-v2-level-top"><div><h3>Level {level}</h3><p>{currentExp} / {nextLevelExp} exp to level {level + 1}</p></div><div className="quest-v2-streak"><strong><Icon name="fire" size={17}/>{activity.dayStreak}</strong><small>day streak</small></div></div>
        <div className="quest-v2-exp-track"><span style={{ width: `${expProgress}%` }} role="progressbar" aria-label="Level progress" aria-valuenow={expProgress} aria-valuemin={0} aria-valuemax={100}/></div>
        <div className="quest-v2-streak-days" aria-label={`${activity.dayStreak} consecutive active days`}>
          {Array.from({ length: 14 }, (_, index) => <span key={index} className={index >= 14 - Math.min(activity.dayStreak, 14) ? 'active' : ''} aria-hidden="true">{index === 13 && activity.dayStreak > 0 ? <Icon name="fire" size={11}/> : null}</span>)}
        </div>
        <p>Your streak tracks consecutive days with saved activity.</p>
      </section>
      <section className="quest-v2-missions" aria-labelledby="quest-v2-missions-title">
        <div className="quest-v2-section-heading"><h3 id="quest-v2-missions-title">Daily missions</h3><span>Resets daily</span></div>
        {dailyMissions.length ? <div className="quest-v2-mission-list">{dailyMissions.map(mission => <div key={mission.key} className={`quest-v2-mission ${mission.complete ? 'complete' : ''}`} aria-label={`${mission.title}, ${mission.progress} of ${mission.target}`}>
          <span className="quest-v2-mission-icon"><Icon name={mission.complete ? 'check' : mission.key === 'workout' ? 'dumbbell' : mission.key === 'meals' ? 'meal' : 'water'} size={17}/></span>
          <span className="quest-v2-mission-main"><strong>{mission.title}</strong><span className="quest-v2-mission-progress"><i><b style={{ width: `${Math.min(mission.progress / mission.target * 100, 100)}%` }}/></i><small>{mission.progress}/{mission.target}</small></span></span>
          <strong className="quest-v2-mission-points">+{mission.points}</strong>
        </div>)}</div> : <p className="quest-v2-empty">No daily missions are available.</p>}
      </section>
      <section className="quest-v2-badges" aria-labelledby="quest-v2-badges-title">
        <div className="quest-v2-section-heading"><h3 id="quest-v2-badges-title">Badges</h3><span>{badges.filter(badge => badge.earned).length} of {badges.length}</span></div>
        <div className="quest-v2-badge-grid">{badges.map(badge => <div key={badge.id} className={`quest-v2-badge ${badge.earned ? 'earned' : 'locked'}`}><span><Icon name={badge.icon} size={20}/>{!badge.earned && <i><Icon name="lock" size={9}/></i>}</span><small>{badge.title}</small></div>)}</div>
      </section>
    </div>
    <BottomNav />
  </section>;
}
