'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Home/icons';
import BottomNav from '../Home/BottomNav';
import type { Profile } from '../Home/types';
import { useActivity, type ActivityBadge } from '../../hooks/useActivity';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useSettings } from '../../hooks/useSettings';
import { api, type LeaderboardEntryRecord, type LeaderboardPeriod, type StrengthLeaderboardRecord } from '../../lib/api';
import { useScreenRoute } from '../../hooks/useScreenRoute';
import { formatLocalDate } from '../../lib/localDate.mjs';
import './leaderboard.css';
import './quests-reference.css';
import StrengthFilters from './StrengthFilters';
import { badgeGroups, buildBadgeCollection } from './badgeProgress';
import type { LeaderboardRecord, WorkoutSessionRecord, WorkoutSummary } from '../../lib/api';

type Screen = 'quests' | 'leaderboard' | 'badges';
const featuredBadgeIds = ['streak-1', 'first-workout', 'early-bird', 'personal-record', 'best-form', 'goal-1', 'hydration-1', 'macro-master'];

export function BadgeIcon({ badge }: { badge: ActivityBadge }) {
  const custom = /^(personal-record|goal-7|top-(100|50|10|1)|best-form|level-(beginner|amateur|pro|veteran)|calories-(100|1000|10000|100000)|lift-(50|150)|hydration-20|streak-(30|100)|first-workout)$/.test(badge.id);
  if (custom) return <img className="badge-art" src={`/badges/${badge.id}.png`} alt="" width={72} height={72}/>;
  const [family, count] = badge.id.split('-');
  const contextualIcon = badge.id === 'early-bird' ? 'sunrise' : badge.id === 'macro-master' ? 'meal-lunch' : family === 'goal' ? 'goal-milestones' : family === 'lift' || family === 'workouts' ? 'library-dumbbells' : badge.icon;
  if (['streak', 'workouts', 'hydration', 'lift', 'goal'].includes(family)) {
    const milestone = Number(count);
    const tier = milestone >= (family === 'lift' ? 100 : 50) ? 'summit' : milestone >= (family === 'lift' ? 75 : 10) ? 'advanced' : milestone >= 3 ? 'rising' : 'starter';
    return <span className={`badge-generated badge-generated-${family} badge-tier-${tier}`} aria-hidden="true"><Icon name={contextualIcon} size={22}/><b>{count}</b></span>;
  }
  return <span className={`badge-generated badge-generated-special badge-generated-${badge.id}`} aria-hidden="true"><Icon name={contextualIcon} size={22}/></span>;
}

function BadgeMark({ badge }: { badge: ActivityBadge }) {
  return <><BadgeIcon badge={badge}/>{!badge.earned && <span className={`badge-lock ${badge.available === false ? 'badge-lock-unavailable' : ''}`} aria-hidden="true"><Icon name="lock" size={12}/></span>}</>;
}

function openBadgeCard(badge: ActivityBadge) {
  if (badge.earned && badge.available !== false) window.dispatchEvent(new CustomEvent('physiquequest:show-badge-card', { detail: badge }));
}

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
  return typeof movement === 'number' && movement !== 0 ? (movement > 0 ? 'up' : 'down') : 'same';
}

function movementLabel(movement: LeaderboardEntryRecord['movement']) {
  return typeof movement === 'number' && movement !== 0 ? `${Math.abs(movement)} places ${movement > 0 ? 'up' : 'down'}` : 'No rank change';
}

export default function QuestSection({ profile, onLogoutRequest: _onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const { activity, dailyMissions, badges: savedBadges, loading, error, refresh } = useActivity();
  const [badgeData, setBadgeData] = useState<{ ranking: LeaderboardRecord | null; workouts: WorkoutSessionRecord[] | null; summary: WorkoutSummary | null; nutrition: { water: {date: string; glasses: number}[]; meals: {id?: string; date?: string; scanSavedAt?: string; scanGroupId?: string}[]; scanSaveReceipts?: {key: string; mealIds: string[]}[] } | null }>({ ranking: null, workouts: null, summary: null, nutrition: null });
  const { settings } = useSettings();
  const [screen, setScreen] = useScreenRoute<Screen>('/quests', { quests: '', leaderboard: '/leaderboard', badges: '/badges' }, 'quests');
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [ranking, setRanking] = useState<'quests' | 'strength'>('quests');
  const [lift, setLift] = useState('');
  const [measure, setMeasure] = useState<'heaviest' | 'relative'>('heaviest');
  const [strength, setStrength] = useState<StrengthLeaderboardRecord | null>(null);
  const [strengthError, setStrengthError] = useState('');
  const [strengthLoading, setStrengthLoading] = useState(false);
  const [strengthRetry, setStrengthRetry] = useState(0);
  const [today, setToday] = useState(() => formatLocalDate());
  const [weekOffset, setWeekOffset] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.allSettled([api.getLeaderboard('all'), api.getAllWorkouts(), api.getWorkoutSummary(), api.getNutrition()]).then(([rank, workouts, summary, nutrition]) => {
      if (active) setBadgeData({ ranking: rank.status === 'fulfilled' && rank.value?.self && Number.isFinite(rank.value.self.rank) && Number.isFinite(rank.value.self.points) ? rank.value : null, workouts: workouts.status === 'fulfilled' && Array.isArray(workouts.value) ? workouts.value : null, summary: summary.status === 'fulfilled' && Array.isArray(summary.value.trainingDates) && Array.isArray(summary.value.personalRecords) ? summary.value : null, nutrition: nutrition.status === 'fulfilled' && Array.isArray(nutrition.value.water) && Array.isArray(nutrition.value.meals) ? nutrition.value : null });
    });
    return () => { active = false; };
  }, [today, screen]);
  const badges = buildBadgeCollection({ activity, saved: savedBadges, profile, ...badgeData });
  useEffect(() => {
    const update = () => setToday(formatLocalDate());
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => { void refresh(); }, [today, refresh]);
  useEffect(() => { if (screen !== 'leaderboard' || ranking !== 'strength') return; let active = true; setStrengthLoading(true); setStrengthError(''); api.getStrengthLeaderboard(lift, measure).then(data => { if (active) setStrength(data); }).catch(error => { if (active) setStrengthError(error instanceof Error ? error.message : 'Could not load strength rankings.'); }).finally(() => { if (active) setStrengthLoading(false); }); return () => { active = false; }; }, [screen, ranking, lift, measure, strengthRetry]);
  const { data: leaderboard, loading: leaderboardLoading, error: leaderboardError, refresh: refreshLeaderboard } = useLeaderboard(period);
  const level = activity.level;
  const currentExp = activity.currentExp;
  const nextLevelExp = activity.nextLevelExp;
  const expProgress = nextLevelExp ? Math.min(currentExp / nextLevelExp * 100, 100) : 0;
  const todayDate = new Date(`${today}T12:00:00`);
  const weekStart = new Date(todayDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() - weekOffset * 7);
  const createdDate = activity.accountCreatedAt ? new Date(activity.accountCreatedAt) : null;
  const accountDay = createdDate && Number.isFinite(createdDate.getTime()) ? formatLocalDate(createdDate) : null;
  const firstSunday = accountDay ? new Date(`${accountDay}T12:00:00`) : null;
  if (firstSunday) firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());
  const canPrevious = firstSunday !== null && formatLocalDate(weekStart) > formatLocalDate(firstSunday);
  const activeDates = new Set(activity.activityDates ?? []);
  const weekDates = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); return date; });
  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  if (loading) return <section className="quest-section"><header className="quest-v2-header"><h2>Quests</h2></header><div className="profile-load-state" role="status" aria-label="Loading quests" aria-busy="true"><div className="section-placeholder" aria-hidden="true" /></div><BottomNav /></section>;
  if (error) return <section className="quest-section"><div className="profile-load-state" role="alert"><h2>Could not load quests</h2><p>{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></div><BottomNav /></section>;

  if (screen === 'badges') {
    const earned = badges.filter(badge => badge.earned).length;
    const known = new Set(badgeGroups.flatMap(group => group.ids));
    const groups = [...badgeGroups, { name: 'Other achievements', ids: badges.filter(badge => !known.has(badge.id)).map(badge => badge.id) }];
    return <section className="quest-section badge-collection" aria-label="Badge collection">
      <header className="leaderboard-header pq-page-heading"><button className="coach-back" type="button" onClick={() => setScreen('quests')} aria-label="Back to quests"><Icon name="arrow" size={20}/></button><h2>All Badges</h2></header>
      <div className="leaderboard-scroll badge-collection-scroll"><div className="badge-collection-intro"><span><Icon name="medal" size={23}/></span><div><h3>Your achievements</h3><p>Explore the milestones you can earn.</p></div><strong>{earned} <small>of {badges.length}</small></strong></div>
        {badges.length === 0 && <p className="badge-collection-empty">No badges are available right now.</p>}
        {groups.map(group => { const entries = group.ids.map(id => badges.find(badge => badge.id === id)).filter((badge): badge is ActivityBadge => Boolean(badge)); if (!entries.length) return null; return <section className="badge-category" key={group.name}><div className="badge-category-heading"><h3>{group.name}</h3><span>{entries.filter(badge => badge.earned).length} / {entries.length}</span></div><div className="badge-collection-list">{entries.map(badge => <article className={`badge-collection-row ${badge.earned ? 'earned' : 'locked'}`} key={badge.id}>{badge.earned && badge.available !== false && <button type="button" className="badge-row-action" aria-label={`View ${badge.title} achievement card`} onClick={() => openBadgeCard(badge)}/>}<div className="badge-collection-icon"><BadgeMark badge={badge}/></div><div className="badge-collection-details"><div className="badge-collection-title"><h4>{badge.title}</h4><span>{badge.available === false ? 'Unavailable' : badge.earned ? 'Earned' : 'In progress'}</span></div><p>{badge.description || (badge.earned ? 'Achievement earned.' : 'Keep going to unlock this badge.')}</p>{badge.progress && badge.available !== false ? <><div className="badge-collection-progress" role="progressbar" aria-label={`${badge.title} progress`} aria-valuemin={0} aria-valuemax={badge.progress.target} aria-valuenow={Math.min(badge.progress.current, badge.progress.target)}><span style={{width: `${Math.min(100, badge.progress.current / badge.progress.target * 100)}%`}}/></div><small>{badge.progress.current} / {badge.progress.target} {badge.progress.unit}</small></> : badge.progressText && badge.available !== false ? <small>{badge.progressText}</small> : badge.available !== false && !badge.earned ? <small>Detailed progress is unavailable.</small> : null}</div></article>)}</div></section>; })}
      </div><BottomNav />
    </section>;
  }

  if (screen === 'leaderboard') {
    const entries = leaderboard?.entries ?? [];
    const podium = [entries[1], entries[0], entries[2]].filter((entry): entry is LeaderboardEntryRecord => Boolean(entry));
    const currentName = profile.name.trim() || 'You';
    return <section className="quest-section leaderboard-screen" aria-label="Leaderboard">
      <header className="leaderboard-header pq-page-heading">
        <button className="coach-back" type="button" onClick={() => setScreen('quests')} aria-label="Back to quests"><Icon name="arrow" size={20}/></button>
        <h2>Leaderboard</h2>
      </header>
      <div className="leaderboard-scroll">
        <div className="leaderboard-mode" role="group" aria-label="Leaderboard category"><button type="button" aria-pressed={ranking === 'quests'} onClick={() => setRanking('quests')}><Icon name="trophy" size={19}/><span><strong>Quests</strong><small>Points earned</small></span></button><button type="button" aria-pressed={ranking === 'strength'} onClick={() => setRanking('strength')}><Icon name="dumbbell" size={19}/><span><strong>Strength</strong><small>Logged lifts</small></span></button></div>
        <section className="leaderboard-overview" aria-label="Your standing"><div className="leaderboard-overview-icon"><Icon name={ranking === 'quests' ? 'trophy' : 'dumbbell'} size={22}/></div><div className="leaderboard-overview-main"><span>YOUR STANDING</span><strong>{ranking === 'quests' ? (leaderboard && settings.showLeaderboard ? `#${leaderboard.self.rank}` : '—') : (strength?.self ? `#${strength.self.rank}` : '—')}</strong><small>{ranking === 'quests' ? (leaderboard && settings.showLeaderboard ? `${formatPoints(leaderboard.self.points)} points` : 'Rank unavailable') : (strength?.self ? (measure === 'relative' ? `${strength.self.score.toFixed(2)}× bodyweight` : `${strength.self.maxKg.toFixed(1)} kg estimated max`) : 'Log a lift to get ranked')}</small></div><div className="leaderboard-overview-meta"><Icon name="chart-bars" size={18}/><small>{ranking === 'quests' ? periodLabels.find(item => item.key === period)?.label : 'Strength'}</small></div></section>
        {ranking === 'quests' ? <>
        <div className="leaderboard-periods" role="tablist" aria-label="Leaderboard period">
          {periodLabels.map(option => <button key={option.key} type="button" role="tab" aria-selected={period === option.key} aria-pressed={period === option.key} className={period === option.key ? 'selected' : ''} onClick={() => setPeriod(option.key)}>{option.label}</button>)}
        </div>
        {leaderboardLoading ? <div className="profile-load-state" role="status"><h2>Loading rankings…</h2></div> : leaderboardError ? <div className="profile-load-state" role="alert"><h2>Could not load rankings</h2><p>{leaderboardError}</p><button type="button" onClick={() => void refreshLeaderboard()}>Try again</button></div> : entries.length === 0 ? <p className="leaderboard-context" role="status">No ranked activity in this period yet.</p> : <>
          <div className="leaderboard-section-title"><div><span>THE TOP THREE</span><h3>Leading the way</h3></div><Icon name="medal" size={21}/></div><section className="leaderboard-podium" aria-label="Top three players">
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
          <div className="leaderboard-list-heading"><div><h3>Standings</h3><p>{entries.length} visible {entries.length === 1 ? 'member' : 'members'}</p></div><Icon name="chart-bars" size={19}/></div>
          <div className="leaderboard-rankings" role="list" aria-label="Leaderboard rankings">
            {entries.slice(3).map(entry => <div className="leaderboard-row" role="listitem" key={entry.userId}>
              <span className="leaderboard-rank">{entry.rank}</span>
              <span className="leaderboard-avatar">{getInitials(entry.name)}</span>
              <span className="leaderboard-person"><strong>{entry.name}</strong><small>{formatPoints(entry.points)} pts</small></span>
              <span className={`leaderboard-movement ${movementClass(entry.movement)}`} aria-label={movementLabel(entry.movement)}>
                {typeof entry.movement === 'number' && entry.movement !== 0 ? <><Icon name={entry.movement > 0 ? 'arrow-up' : 'arrow-down'} size={14}/> {Math.abs(entry.movement)}</> : <Icon name="minus" size={14}/>}
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
              {typeof leaderboard.self.movement === 'number' && leaderboard.self.movement !== 0 ? <><Icon name={leaderboard.self.movement > 0 ? 'arrow-up' : 'arrow-down'} size={14}/> {Math.abs(leaderboard.self.movement)}</> : <Icon name="minus" size={14}/>}
            </span>
          </div>
          {leaderboard.context && <p className="leaderboard-context">{formatPoints(leaderboard.context.pointsBehind)} pts behind {leaderboard.context.previousName}.</p>}
        </> : !settings.showLeaderboard ? <p className="leaderboard-context" role="status">Your ranking is hidden. Turn on leaderboard visibility in privacy settings to show your profile.</p> : null}
        <p className="leaderboard-privacy">Your ranking is hidden if you turn the leaderboard off in privacy settings.</p>
        </> : <>
          <StrengthFilters exercises={strength?.exercises ?? []} selected={lift || strength?.exerciseId || ''} onSelect={setLift} loading={strengthLoading} error={Boolean(strengthError)}/>
          <div className="leaderboard-mode leaderboard-measure" role="group" aria-label="Strength ranking method"><button type="button" aria-pressed={measure === 'heaviest'} onClick={() => setMeasure('heaviest')}><strong>Heaviest lift</strong><small>Estimated one-rep max</small></button><button type="button" aria-pressed={measure === 'relative'} onClick={() => setMeasure('relative')}><strong>Pound for pound</strong><small>One-rep max ÷ bodyweight</small></button></div>
          {strengthLoading ? <p className="leaderboard-context" role="status">Loading strength rankings…</p> : strengthError ? <p className="leaderboard-context" role="alert">{strengthError}</p> : !strength?.entries.length ? <div className="leaderboard-strength-empty" role="status"><Icon name="trophy" size={24}/><h3>No rankings yet</h3><p>{measure === 'relative' ? 'A saved bodyweight and a logged lift are needed for this ranking.' : 'Complete a workout with a recorded weight to join the leaderboard.'}</p></div> : <><section className="leaderboard-podium" aria-label="Top three lifters">{[strength.entries[1], strength.entries[0], strength.entries[2]].filter(Boolean).map(entry => <div className={`podium-player podium-rank-${entry.rank}`} key={entry.userId}>{entry.rank === 1 && <Icon name="crown" size={19}/>}<div className="podium-avatar">{getInitials(entry.name)}</div><strong>{entry.name}</strong><small>{measure === 'relative' ? `${entry.score.toFixed(2)}× BW` : `${entry.maxKg.toFixed(1)} kg`}</small><div className="podium-step">{entry.rank}</div></div>)}</section><div className="leaderboard-rankings" role="list" aria-label="Strength rankings">{strength.entries.slice(3).map(entry => <div className="leaderboard-row" role="listitem" key={entry.userId}><span className="leaderboard-rank">{entry.rank}</span><span className="leaderboard-avatar">{getInitials(entry.name)}</span><span className="leaderboard-person"><strong>{entry.name}</strong><small>{entry.loadKg} kg × {entry.reps} reps</small></span><strong>{measure === 'relative' ? `${entry.score.toFixed(2)}× BW` : `${entry.maxKg.toFixed(1)} kg`}</strong></div>)}</div></>}
          {strengthError && <button type="button" className="strength-retry" onClick={() => setStrengthRetry(value => value + 1)}>Try again</button>}
          {!strengthLoading && !strengthError && !!strength?.participants?.length && <section className="leaderboard-unranked" aria-labelledby="strength-unranked-title"><div className="leaderboard-list-heading"><div><h3 id="strength-unranked-title">Community members</h3><p>Not yet ranked for this selection</p></div><Icon name="user" size={19}/></div><div className="leaderboard-rankings" role="list">{strength.participants.map(person => <div className="leaderboard-row" role="listitem" key={person.userId}><span className="leaderboard-rank">—</span><span className="leaderboard-avatar">{getInitials(person.name)}</span><span className="leaderboard-person"><strong>{person.isCurrentUser ? `You · ${person.name}` : person.name}</strong><small>{measure === 'relative' ? 'No eligible lift or bodyweight' : 'No eligible lift yet'}</small></span></div>)}</div></section>}
          {!strengthLoading && !strengthError && strength?.self && <div className="leaderboard-self-row"><span className="leaderboard-rank">{strength.self.rank}</span><span className="leaderboard-self-avatar">{getInitials(currentName)}</span><span className="leaderboard-person"><strong>You · {currentName}</strong><small>{strength.hidden ? 'Hidden from others' : `${strength.self.loadKg} kg × ${strength.self.reps} reps`}</small></span><strong>{measure === 'relative' ? `${strength.self.score.toFixed(2)}× BW` : `${strength.self.maxKg.toFixed(1)} kg`}</strong></div>}
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
        {weekOffset === 0 && <div className="streak-week-current">This week</div>}
        <div className="streak-week-heading"><button type="button" aria-label="Previous week" disabled={!canPrevious} onClick={() => setWeekOffset(value => value + 1)}><Icon name="chevron-left" size={20}/></button><strong aria-live="polite">{weekLabel}</strong><button type="button" aria-label="Next week" disabled={weekOffset === 0} onClick={() => setWeekOffset(value => Math.max(0, value - 1))}><Icon name="chevron-right" size={20}/></button></div>
        {accountDay && activity.activityDates ? <div className="quest-v2-streak-days" aria-label="Weekly activity">
          {weekDates.map((date, index) => { const day = formatLocalDate(date); const available = day >= accountDay && day <= today; const active = available && activeDates.has(day); return <div className="streak-week-day" key={day} aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}: ${!available ? day > today ? 'future' : 'before account creation' : active ? 'activity recorded' : 'no activity'}`}><small>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][index]}</small><span className={`${active ? 'active' : ''} ${!available ? 'unavailable' : ''}`}>{active && <Icon name="fire" size={14}/>}</span><small>{date.getDate()}</small></div>; })}
        </div> : <p role="status">Streak history is unavailable. Refresh to try again.</p>}
        <p>Your streak tracks consecutive days with saved activity.</p>
      </section>
      <section className="quest-v2-missions" aria-labelledby="quest-v2-missions-title">
        <div className="quest-v2-section-heading"><h3 id="quest-v2-missions-title">Daily missions</h3><span>Resets daily</span></div>
        {dailyMissions.length ? <div className="quest-v2-mission-list">{dailyMissions.map(mission => <div key={mission.key} className={`quest-v2-mission ${mission.complete ? 'complete' : ''}`} aria-label={`${mission.title}, ${mission.progress} of ${mission.target}`}>
          <span className="quest-v2-mission-icon"><Icon name={mission.complete ? 'check' : mission.key === 'workout' ? 'dumbbell' : mission.key === 'meals' ? 'meal' : mission.key === 'water' ? 'water' : 'trophy'} size={17}/></span>
          <span className="quest-v2-mission-main"><strong>{mission.title}</strong><span className="quest-v2-mission-progress"><i><b style={{ width: `${Math.min(mission.progress / mission.target * 100, 100)}%` }}/></i><small>{mission.progress}/{mission.target}</small></span></span>
          <strong className="quest-v2-mission-points">+{mission.points}</strong>
        </div>)}</div> : <p className="quest-v2-empty">No daily missions are available.</p>}
      </section>
      <section className="quest-v2-badges" aria-labelledby="quest-v2-badges-title">
        <div className="quest-v2-section-heading quest-badge-heading"><h3 id="quest-v2-badges-title">Badges</h3><div><span>{badges.filter(badge => badge.earned).length} of {badges.length} earned</span><button type="button" onClick={() => setScreen('badges')}>View all <Icon name="chevron-right" size={16}/></button></div></div>
        <div className="quest-v2-badge-grid">{featuredBadgeIds.map(id => badges.find(badge => badge.id === id)).filter((badge): badge is ActivityBadge => Boolean(badge)).map(badge => <button type="button" key={badge.id} className={`quest-v2-badge ${badge.earned ? 'earned' : 'locked'}`} title={badge.description} disabled={!badge.earned || badge.available === false} onClick={() => openBadgeCard(badge)} aria-label={`${badge.title}: ${badge.available === false ? 'unavailable' : badge.earned ? 'earned, view achievement card' : 'locked'}${badge.description ? `. ${badge.description}` : ''}`}><span><BadgeMark badge={badge}/></span><small>{badge.title}{badge.available === false && <><br/>Unavailable</>}</small></button>)}</div>
      </section>
    </div>
    <BottomNav />
  </section>;
}
