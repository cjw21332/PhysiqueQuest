'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Home/icons';
import BottomNav from '../Home/BottomNav';
import type { Profile } from '../Home/types';
import { useActivity } from '../../hooks/useActivity';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useSettings } from '../../hooks/useSettings';
import { api, type LeaderboardEntryRecord, type LeaderboardPeriod, type StrengthLeaderboardRecord } from '../../lib/api';
import { titleCase } from '../../lib/titleCase';
import { useScreenRoute } from '../../hooks/useScreenRoute';
import './leaderboard.css';
import './quests-reference.css';

type Screen = 'quests' | 'leaderboard';

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

function movementClass(movement: LeaderboardEntryRecord['movement']) {
  return typeof movement === 'number' ? (movement > 0 ? 'up' : 'down') : 'same';
}

function movementLabel(movement: LeaderboardEntryRecord['movement']) {
  return typeof movement === 'number' ? `${Math.abs(movement)} places ${movement > 0 ? 'up' : 'down'}` : 'No rank change';
}

export default function QuestSection({ profile, onLogoutRequest: _onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const { activity, dailyMissions, badges, loading, error, refresh } = useActivity();
  const { settings } = useSettings();
  const [screen, setScreen] = useScreenRoute<Screen>('/quests', { quests: '', leaderboard: '/leaderboard' }, 'quests');
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [ranking, setRanking] = useState<'quests' | 'strength'>('quests');
  const [lift, setLift] = useState('');
  const [measure, setMeasure] = useState<'heaviest' | 'relative'>('heaviest');
  const [strength, setStrength] = useState<StrengthLeaderboardRecord | null>(null);
  const [strengthError, setStrengthError] = useState('');
  const [strengthLoading, setStrengthLoading] = useState(false);
  useEffect(() => { if (screen !== 'leaderboard' || ranking !== 'strength') return; let active = true; setStrengthLoading(true); setStrengthError(''); api.getStrengthLeaderboard(lift, measure).then(data => { if (active) setStrength(data); }).catch(error => { if (active) setStrengthError(error instanceof Error ? error.message : 'Could not load strength rankings.'); }).finally(() => { if (active) setStrengthLoading(false); }); return () => { active = false; }; }, [screen, ranking, lift, measure]);
  const { data: leaderboard, loading: leaderboardLoading, error: leaderboardError, refresh: refreshLeaderboard } = useLeaderboard(period);
  const level = activity.level;
  const currentExp = activity.currentExp;
  const nextLevelExp = activity.nextLevelExp;
  const expProgress = nextLevelExp ? Math.min(currentExp / nextLevelExp * 100, 100) : 0;

  if (loading) return <section className="quest-section"><header className="quest-v2-header"><h2>Quests</h2></header><div className="profile-load-state" role="status" aria-label="Loading quests" aria-busy="true"><div className="section-placeholder" aria-hidden="true" /></div><BottomNav /></section>;
  if (error) return <section className="quest-section"><div className="profile-load-state" role="alert"><h2>Could not load quests</h2><p>{error}</p><button onClick={() => void refresh()}>Try again</button></div><BottomNav /></section>;

  if (screen === 'leaderboard') {
    const entries = leaderboard?.entries ?? [];
    const podium = [entries[1], entries[0], entries[2]].filter((entry): entry is LeaderboardEntryRecord => Boolean(entry));
    const currentName = profile.name.trim() || 'You';
    return <section className="quest-section leaderboard-screen" aria-label="Leaderboard">
      <header className="leaderboard-header">
        <button className="leaderboard-back" type="button" onClick={() => setScreen('quests')} aria-label="Back to quests"><Icon name="arrow" size={19}/></button>
        <h2>Leaderboard</h2>
      </header>
      <div className="leaderboard-scroll">
        <div className="leaderboard-mode" role="group" aria-label="Leaderboard category"><button type="button" aria-pressed={ranking === 'quests'} onClick={() => setRanking('quests')}><strong>Quests</strong><small>Points earned</small></button><button type="button" aria-pressed={ranking === 'strength'} onClick={() => setRanking('strength')}><strong>Strength</strong><small>Logged lifts</small></button></div>
        {ranking === 'quests' ? <>
        <div className="leaderboard-periods" role="tablist" aria-label="Leaderboard period">
          {periodLabels.map(option => <button key={option.key} type="button" role="tab" aria-selected={period === option.key} aria-pressed={period === option.key} className={period === option.key ? 'selected' : ''} onClick={() => setPeriod(option.key)}>{option.label}</button>)}
        </div>
        {leaderboardLoading ? <div className="profile-load-state" role="status"><h2>Loading rankings…</h2></div> : leaderboardError ? <div className="profile-load-state" role="alert"><h2>Could not load rankings</h2><p>{leaderboardError}</p><button onClick={() => void refreshLeaderboard()}>Try again</button></div> : entries.length === 0 ? <p className="leaderboard-context" role="status">No ranked activity in this period yet.</p> : <>
          <section className="leaderboard-podium" aria-label="Top three players">
            {podium.map(entry => {
              const rank = entry.rank;
              return <div className={`podium-player podium-rank-${rank}`} key={entry.userId}>
                {rank === 1 && <Icon name="crown" size={19}/>}
                <div className="podium-avatar">{getInitials(entry.name)}</div>
                <strong>{entry.name}</strong>
                <small>{formatPoints(entry.points)} pts</small>
                <div className="podium-step">{rank}</div>
              </div>;
            })}
          </section>
          <div className="leaderboard-rankings" role="list" aria-label="Leaderboard rankings">
            {entries.slice(3).map(entry => <div className="leaderboard-row" role="listitem" key={entry.userId}>
              <span className="leaderboard-rank">{entry.rank}</span>
              <span className="leaderboard-avatar">{getInitials(entry.name)}</span>
              <span className="leaderboard-person"><strong>{entry.name}</strong><small>{formatPoints(entry.points)} pts</small></span>
              <span className={`leaderboard-movement ${movementClass(entry.movement)}`} aria-label={movementLabel(entry.movement)}>
                {typeof entry.movement === 'number' ? <>{entry.movement > 0 ? '↑' : '↓'} {Math.abs(entry.movement)}</> : '—'}
              </span>
            </div>)}
          </div>
        </>}
        {leaderboard && settings.showLeaderboard ? <>
          <div className="leaderboard-self-row" aria-label={`Your rank, ${leaderboard.self.rank}, ${currentName}`}>
            <span className="leaderboard-rank">{leaderboard.self.rank}</span>
            <span className="leaderboard-self-avatar">{profile.photo ? <img src={profile.photo} alt="" className="leaderboard-profile-photo"/> : getInitials(currentName)}</span>
            <span className="leaderboard-person"><strong>You · {currentName}</strong><small>{formatPoints(leaderboard.self.points)} pts · {activity.dayStreak}-day streak</small></span>
            <span className={`leaderboard-movement ${movementClass(leaderboard.self.movement)}`} aria-label={movementLabel(leaderboard.self.movement)}>
              {typeof leaderboard.self.movement === 'number' ? <>{leaderboard.self.movement > 0 ? '↑' : '↓'} {Math.abs(leaderboard.self.movement)}</> : '—'}
            </span>
          </div>
          {leaderboard.context && <p className="leaderboard-context">{formatPoints(leaderboard.context.pointsBehind)} pts behind {leaderboard.context.previousName} — a strong week closes most of it.</p>}
        </> : <p className="leaderboard-context" role="status">Your ranking is hidden. Turn on leaderboard visibility in privacy settings to show your profile.</p>}
        <p className="leaderboard-privacy">Your ranking is hidden if you turn the leaderboard off in privacy settings.</p>
        </> : <>
          <div className="leaderboard-lifts" role="group" aria-label="Exercise">{strength?.exercises.map(item => <button key={item.id} type="button" aria-pressed={(lift || strength.exerciseId) === item.id} onClick={() => setLift(item.id)}>{titleCase(item.name)}</button>)}</div>
          <div className="leaderboard-mode leaderboard-measure" role="group" aria-label="Strength ranking method"><button type="button" aria-pressed={measure === 'heaviest'} onClick={() => setMeasure('heaviest')}><strong>Heaviest lift</strong><small>Estimated one-rep max</small></button><button type="button" aria-pressed={measure === 'relative'} onClick={() => setMeasure('relative')}><strong>Pound for pound</strong><small>One-rep max ÷ bodyweight</small></button></div>
          {strengthLoading ? <p className="leaderboard-context" role="status">Loading strength rankings…</p> : strengthError ? <p className="leaderboard-context" role="alert">{strengthError}</p> : !strength?.entries.length ? <div className="leaderboard-strength-empty" role="status"><Icon name="trophy" size={24}/><h3>No rankings yet</h3><p>{measure === 'relative' ? 'A saved bodyweight and a logged lift are needed for this ranking.' : 'Complete a workout with a recorded weight to join the leaderboard.'}</p></div> : <><section className="leaderboard-podium" aria-label="Top three lifters">{[strength.entries[1], strength.entries[0], strength.entries[2]].filter(Boolean).map(entry => <div className={`podium-player podium-rank-${entry.rank}`} key={entry.userId}>{entry.rank === 1 && <Icon name="crown" size={19}/>}<div className="podium-avatar">{getInitials(entry.name)}</div><strong>{entry.name}</strong><small>{measure === 'relative' ? `${entry.score.toFixed(2)}× BW` : `${entry.maxKg.toFixed(1)} kg`}</small><div className="podium-step">{entry.rank}</div></div>)}</section><div className="leaderboard-rankings" role="list" aria-label="Strength rankings">{strength.entries.slice(3).map(entry => <div className="leaderboard-row" role="listitem" key={entry.userId}><span className="leaderboard-rank">{entry.rank}</span><span className="leaderboard-avatar">{getInitials(entry.name)}</span><span className="leaderboard-person"><strong>{entry.name}</strong><small>{entry.loadKg} kg × {entry.reps} reps</small></span><strong>{measure === 'relative' ? `${entry.score.toFixed(2)}× BW` : `${entry.maxKg.toFixed(1)} kg`}</strong></div>)}</div></>}
          {strength?.self && <div className="leaderboard-self-row"><span className="leaderboard-rank">{strength.self.rank}</span><span className="leaderboard-self-avatar">{getInitials(currentName)}</span><span className="leaderboard-person"><strong>You · {currentName}</strong><small>{strength.hidden ? 'Hidden from others' : `${strength.self.loadKg} kg × ${strength.self.reps} reps`}</small></span><strong>{measure === 'relative' ? `${strength.self.score.toFixed(2)}× BW` : `${strength.self.maxKg.toFixed(1)} kg`}</strong></div>}
          <p className="leaderboard-privacy">Self-reported completed sets, up to 30 reps. Single reps use the logged weight; other sets use an estimated one-rep max. Pound for pound divides that estimate by your current bodyweight. Estimates are less reliable at higher reps.</p>
        </>}
      </div>
      <BottomNav />
    </section>;
  }

  return <section className="quest-section quests-reference" aria-label="Quests">
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
          <span className="quest-v2-mission-icon"><Icon name={mission.complete ? 'check' : mission.key === 'workout' ? 'dumbbell' : mission.key === 'meals' ? 'meal' : mission.key === 'personal-record' ? 'trophy' : 'water'} size={17}/></span>
          <span className="quest-v2-mission-main"><strong>{mission.title}</strong><span className="quest-v2-mission-progress"><i><b style={{ width: `${Math.min(mission.progress / mission.target * 100, 100)}%` }}/></i><small>{mission.progress}/{mission.target}</small></span></span>
          <strong className="quest-v2-mission-points">+{mission.points}</strong>
        </div>)}</div> : <p className="quest-v2-empty">No daily missions are available.</p>}
      </section>
      <section className="quest-v2-badges" aria-labelledby="quest-v2-badges-title">
        <div className="quest-v2-section-heading"><h3 id="quest-v2-badges-title">Badges</h3><span>{badges.filter(badge => badge.earned).length} of {badges.length}</span></div>
        <div className="quest-v2-badge-grid">{badges.map(badge => <div key={badge.id} className={`quest-v2-badge ${badge.earned ? 'earned' : 'locked'}`} title={badge.description} aria-label={`${badge.title}: ${badge.available === false ? 'unavailable' : badge.earned ? 'earned' : 'locked'}${badge.description ? `. ${badge.description}` : ''}`}><span><Icon name={badge.icon} size={20}/>{!badge.earned && <i><Icon name="lock" size={9}/></i>}</span><small>{badge.title}{badge.available === false && <><br/>Unavailable</>}</small></div>)}</div>
      </section>
    </div>
    <BottomNav />
  </section>;
}
