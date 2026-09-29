'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Home/icons';

type QuestProgress = { workout: number; meals: number; water: number; personalRecord: number };
const initialProgress: QuestProgress = { workout: 0, meals: 2, water: 5, personalRecord: 1 };
const missionConfig = [
  { key: 'workout', title: 'Complete one workout', total: 1, points: 100, icon: 'dumbbell' },
  { key: 'meals', title: 'Log 3 meals', total: 3, points: 60, icon: 'meal' },
  { key: 'water', title: 'Drink 8 glasses of water', total: 8, points: 40, icon: 'water' },
  { key: 'personalRecord', title: 'Beat one personal record', total: 1, points: 150, icon: 'check' },
] as const;
const badges = [
  { icon: 'fire', title: '10-day streak', earned: true },
  { icon: 'trophy', title: 'First PR', earned: true },
  { icon: 'medal', title: 'Perfect form', earned: true },
  { icon: 'water', title: 'Hydrated', earned: true },
  { icon: 'target', title: 'Macro master', earned: false },
  { icon: 'fire', title: '30-day streak', earned: false },
  { icon: 'crown', title: 'Top 10', earned: false },
  { icon: 'sun', title: 'Early bird', earned: false },
];
const validKeys = missionConfig.map(item => item.key);

function MissionIcon({ name }: { name: string }) {
  return <Icon name={name} size={15}/>;
}

export default function QuestSection() {
  const [progress, setProgress] = useState<QuestProgress>(initialProgress);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('physiquequest-quests');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<QuestProgress>;
        const safe = { ...initialProgress };
        for (const key of validKeys) {
          const value = parsed[key];
          if (Number.isFinite(value)) safe[key] = Math.max(0, Math.min(missionConfig.find(m => m.key === key)!.total, Number(value)));
        }
        setProgress(safe);
      }
    } catch { /* Start with today's sample progress when saved data is unavailable. */ }
    setReady(true);
  }, []);

  useEffect(() => { if (ready) localStorage.setItem('physiquequest-quests', JSON.stringify(progress)); }, [progress, ready]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const updateMission = (key: keyof QuestProgress, total: number) => {
    setProgress(current => ({ ...current, [key]: Math.min(total, current[key] + 1) }));
  };

  return <section className="quest-section" aria-label="Quests">
    <header className="quest-header"><h2>Quests</h2><button onClick={() => setNotice('Leaderboard rankings are coming soon.')}><Icon name="trophy" size={13}/>Leaderboard</button></header>
    <div className="quest-scroll">
      <section className="quest-level-card" aria-label="Level and streak progress">
        <div className="quest-level-top"><div><h3>Level 7</h3><small>340 / 500 exp to level 8</small></div><div className="quest-streak"><b><span>♨</span> 12</b><small>day streak</small></div></div>
        <div className="quest-exp-track"><i/></div>
        <div className="streak-calendar" aria-label="Streak calendar">
          {Array.from({ length: 14 }, (_, index) => <span key={index} className={index < 7 || (index >= 8 && index < 12) ? 'filled' : index === 7 ? 'freeze' : index === 12 ? 'today' : ''}>{index === 7 ? '✿' : ''}</span>)}
        </div>
        <p>One freeze used — streaks are forgiving by design.</p>
      </section>

      <section className="quest-missions">
        <div className="quest-section-head"><h3>Daily missions</h3><span>Resets in 4h 12m</span></div>
        {missionConfig.map((mission, index) => {
          const amount = progress[mission.key];
          const complete = amount >= mission.total;
          return <button className={`quest-mission ${complete ? 'complete' : ''}`} key={mission.key} onClick={() => updateMission(mission.key, mission.total)} aria-label={`${mission.title}, ${amount} of ${mission.total}. ${complete ? 'Completed' : 'Tap to update progress'}`}>
            <span className="quest-mission-icon"><MissionIcon name={mission.icon}/></span>
            <span className="quest-mission-copy"><b>{mission.title}</b><span className="quest-mission-progress"><i><em style={{ width: `${(amount / mission.total) * 100}%` }}/></i><small>{amount}/{mission.total}</small></span></span>
            <strong>+{mission.points}</strong>
          </button>;
        })}
      </section>

      <aside className="quest-penalty"><b>Penalty rule</b><span>1 of 3 strikes</span><p>Missing all daily missions deducts 50 points and adds a strike. Points never drop below your level floor.</p></aside>

      <section className="quest-badges">
        <div className="quest-section-head"><h3>Badges</h3><span>4 of 24</span></div>
        <div className="quest-badge-grid">{badges.map(badge => <div className={`quest-badge ${badge.earned ? 'earned' : 'locked'}`} key={badge.title}>
          <span className="quest-badge-medal"><Icon name={badge.icon} size={21}/>{!badge.earned && <i aria-label="Locked"><Icon name="lock" size={9}/></i>}</span><b>{badge.title}</b>
        </div>)}</div>
      </section>
    </div>
    {notice && <div className="home-toast quest-toast" role="status">{notice}</div>}
  </section>;
}
