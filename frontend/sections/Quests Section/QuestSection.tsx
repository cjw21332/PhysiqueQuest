'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Home/icons';
import BottomNav from '../Home/BottomNav';
import type { Profile } from '../Home/types';

type QuestProgress = {
  workout: number;
  meals: number;
  water: number;
  personalRecord: number;
};

const initialProgress: QuestProgress = {
  workout: 0,
  meals: 2,
  water: 5,
  personalRecord: 1
};

const missionConfig = [
  { key: 'workout', title: 'Complete one workout', total: 1, points: 100, icon: 'dumbbell' },
  { key: 'meals', title: 'Log 3 meals', total: 3, points: 60, icon: 'meal' },
  { key: 'water', title: 'Drink 8 glasses of water', total: 8, points: 40, icon: 'water' },
  { key: 'personalRecord', title: 'Beat one personal record', total: 1, points: 150, icon: 'check' }
] as const;

const badges = [
  { icon: 'fire', title: '10-day streak', earned: true },
  { icon: 'trophy', title: 'First PR', earned: true },
  { icon: 'medal', title: 'Perfect form', earned: true },
  { icon: 'water', title: 'Hydrated', earned: true },
  { icon: 'target', title: 'Macro master', earned: false },
  { icon: 'fire', title: '30-day streak', earned: false },
  { icon: 'crown', title: 'Top 10', earned: false },
  { icon: 'sun', title: 'Early bird', earned: false }
];

const validKeys = missionConfig.map(item => item.key);

export default function QuestSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [progress, setProgress] = useState<QuestProgress>(initialProgress);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setReady(true);
    try {
      const saved = localStorage.getItem('physiquequest-quests');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<QuestProgress>;
        const safe = { ...initialProgress };
        for (const key of validKeys) {
          const value = parsed[key];
          if (Number.isFinite(value)) {
            const mission = missionConfig.find(m => m.key === key);
            if (mission) {
              safe[key] = Math.max(0, Math.min(mission.total, Number(value)));
            }
          }
        }
        setProgress(safe);
      }
    } catch {
      /* Start with sample progress */
    }
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem('physiquequest-quests', JSON.stringify(progress));
  }, [progress, ready]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const updateMission = (key: keyof QuestProgress, total: number) => {
    setProgress(current => ({
      ...current,
      [key]: Math.min(total, current[key] + 1)
    }));
  };

  const level = 7;
  const currentExp = 340;
  const nextLevelExp = 500;
  const expProgress = (currentExp / nextLevelExp) * 100;
  const dayStreak = 12;

  return (
    <section className="quest-section" aria-label="Quests">
      {/* Header */}
      <header className="quests-header">
        <h2 className="quests-title">Quests</h2>
        <button
          className="leaderboard-btn"
          onClick={() => setNotice('Leaderboard rankings are coming soon.')}
        >
          <Icon name="trophy" size={14} />
          Leaderboard
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="quests-scroll">
        {/* Level Card */}
        <section className="level-card">
          <div className="level-header">
            <div className="level-info">
              <h3 className="level-title">Level {level}</h3>
              <div className="level-subtitle">
                {currentExp} / {nextLevelExp} exp to level {level + 1}
              </div>
            </div>
            <div className="streak-info">
              <div className="streak-number">
                <Icon name="fire" size={18} /> {dayStreak}
              </div>
              <div className="streak-label">day streak</div>
            </div>
          </div>

          {/* Experience Progress Bar */}
          <div className="exp-bar">
            <div
              className="exp-bar-fill"
              style={{ width: `${expProgress}%` }}
              role="progressbar"
              aria-valuenow={expProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>

          {/* Streak Calendar */}
          <div className="streak-calendar" role="img" aria-label={`${dayStreak} day streak with ${Array.from({ length: 14 }, (_, i) => (i < 7 || (i >= 8 && i < 12) ? 1 : 0)).reduce<number>((a, b) => a + b, 0)} days completed`}>
            {Array.from({ length: 14 }, (_, index) => {
              const isActive = index < 7 || (index >= 8 && index < 12);
              const isFreeze = index === 7;
              const isToday = index === 12;

              return (
                <div
                  key={index}
                  className={`calendar-day ${
                    isActive ? 'active' : ''
                  } ${isFreeze ? 'freeze' : ''} ${isToday ? 'today' : ''}`}
                  title={isFreeze ? 'Freeze used' : isToday ? 'Today' : isActive ? 'Completed' : 'Missed'}
                >
                  {isFreeze && '❄'}
                </div>
              );
            })}
          </div>

          <div className="freeze-note">
            <Icon name="shield" size={12} /> One freeze used — streaks are forgiving by design.
          </div>
        </section>

        {/* Daily Missions */}
        <section className="missions-section">
          <div className="missions-header">
            <div>
              <h3 className="missions-title">Daily missions</h3>
              <div className="missions-reset">Resets in 4h 12m</div>
            </div>
            <div className="missions-progress">
              {missionConfig.filter(m => progress[m.key] >= m.total).length}/{missionConfig.length}
            </div>
          </div>

          <div className="missions-list">
            {missionConfig.map(mission => {
              const amount = progress[mission.key];
              const complete = amount >= mission.total;
              const percentage = (amount / mission.total) * 100;

              return (
                <button
                  key={mission.key}
                  className={`mission-item ${complete ? 'complete' : ''}`}
                  onClick={() => updateMission(mission.key, mission.total)}
                  aria-label={`${mission.title}, ${amount} of ${mission.total}, ${mission.points} points`}
                  aria-pressed={complete}
                >
                  <div className="mission-icon">
                    <Icon name={complete ? 'check' : mission.icon} size={20} />
                  </div>
                  <div className="mission-content">
                    <div className="mission-top">
                      <div className="mission-title">{mission.title}</div>
                      <div className="mission-points">
                        <Icon name="star" size={14} />
                        {mission.points}
                      </div>
                    </div>
                    {!complete && (
                      <div className="mission-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${percentage}%` }}
                            role="progressbar"
                            aria-valuenow={amount}
                            aria-valuemin={0}
                            aria-valuemax={mission.total}
                          />
                        </div>
                        <div className="progress-text">
                          {amount}/{mission.total}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Penalty Warning */}
        <aside className="penalty-warning">
          <div className="penalty-header">
            <span className="penalty-title">Penalty rule</span>
            <span className="penalty-strikes">1 of 3 strikes</span>
          </div>
          <p className="penalty-text">
            Missing all daily missions deducts 50 points and adds a strike.
            Points never drop below your level floor.
          </p>
        </aside>

        {/* Badges */}
        <section className="badges-section">
          <div className="badges-header">
            <h3 className="badges-title">Badges</h3>
            <div className="badges-count">4 of 24</div>
          </div>

          <div className="badges-grid">
            {badges.map(badge => (
              <div
                key={badge.title}
                className={`badge-item ${badge.earned ? 'earned' : 'locked'}`}
              >
                <div className="badge-icon">
                  <Icon name={badge.icon} size={24} />
                  {!badge.earned && (
                    <div className="badge-lock">
                      <Icon name="lock" size={10} />
                    </div>
                  )}
                </div>
                <div className="badge-name">{badge.title}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <BottomNav />

      {/* Toast Notification */}
      {notice && (
        <div className="home-toast quest-toast" role="status">
          {notice}
        </div>
      )}
    </section>
  );
}
