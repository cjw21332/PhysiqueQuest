'use client';

import { Icon } from './icons';

type Profile = {
  name: string;
  email: string;
  [key: string]: any;
};

export default function HomeDashboard({
  profile,
  onOpen,
  onNotify,
  onAction
}: {
  profile: Profile;
  onOpen: (screen: 'goals' | 'progress') => void;
  onNotify: () => void;
  onAction: (message: string) => void
}) {
  // Get current date info
  const now = new Date();
  const weekDay = now.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="dashboard-container">
      {/* Header with avatar and notification */}
      <header className="dashboard-header">
        <div className="user-greeting">
          <div className="avatar-badge">
            <Icon name="user" size={20} />
          </div>
          <div className="greeting-text">
            <small className="greeting-meta">{weekDay} · Week 3</small>
            <h1 className="greeting-name">Hi, {profile.name.split(' ')[0] || 'Toji'}</h1>
          </div>
        </div>
        <button
          className="notification-bell"
          aria-label="Notifications"
          onClick={onNotify}
        >
          <Icon name="bell" size={20} />
          <span className="bell-dot" aria-hidden="true"></span>
        </button>
      </header>

      {/* Today's Workout Session Card */}
      <section className="workout-card">
        <div className="workout-header">
          <small className="workout-label">Today's session</small>
          <div className="workout-duration">
            <Icon name="clock" size={12} />
            <span>45min</span>
          </div>
        </div>
        <h2 className="workout-title">Upper Body — Push</h2>
        <div className="workout-meta">
          <span className="workout-detail">
            <Icon name="dumbbell" size={12} />
            6exercises · Dumbbells
          </span>
          <span className="workout-detail">
            <Icon name="scan" size={12} />
            AI form tracking
          </span>
        </div>
        <button
          className="start-button"
          onClick={() => onAction('Starting workout session...')}
        >
          <Icon name="play" size={14} />
          Start workout
        </button>
        <button
          className="link-text"
          onClick={() => onOpen('progress')}
        >
          View full plan
        </button>
      </section>

      {/* Stats Row */}
      <section className="stats-row">
        <div className="stat-box">
          <div className="stat-icon stat-icon-fire">
            <Icon name="fire" size={14} />
          </div>
          <div className="stat-number">12</div>
          <div className="stat-text">day streak</div>
        </div>
        <div className="stat-separator"></div>
        <div className="stat-box">
          <div className="stat-number">1,840</div>
          <div className="stat-text">points</div>
        </div>
        <div className="stat-separator"></div>
        <div className="stat-box stat-level-box">
          <div className="stat-number">Lv 7</div>
          <div className="level-bar-container">
            <div className="level-bar-fill" style={{ width: '68%' }}></div>
          </div>
          <div className="stat-text">Level</div>
        </div>
      </section>

      {/* Daily Missions */}
      <section className="content-section">
        <div className="section-title-row">
          <h3 className="section-title">Daily missions · 0 of 3</h3>
          <button
            className="view-all-link"
            onClick={() => onOpen('progress')}
          >
            View all
          </button>
        </div>
        <div className="missions-container">
          <MissionCard title="Complete one workout" current={0} total={1} />
          <MissionCard title="Log 3 meals" current={2} total={3} />
          <MissionCard title="Drink 8 glasses of water" current={5} total={8} />
        </div>
      </section>

      {/* Nutrition Today */}
      <section className="content-section">
        <div className="section-title-row">
          <h3 className="section-title">Nutrition today</h3>
          <button
            className="scan-link"
            onClick={() => onAction('Opening meal scanner...')}
          >
            <Icon name="scan" size={12} />
            Scan meal
          </button>
        </div>
        <div className="nutrition-overview">
          <div className="calorie-circle">
            <svg className="circle-svg" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                className="circle-bg"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                className="circle-progress"
                strokeDasharray="283"
                strokeDashoffset="85"
              />
            </svg>
            <div className="circle-content">
              <div className="calorie-amount">1.4k</div>
              <div className="calorie-goal">of 2,300</div>
            </div>
          </div>
          <div className="macros-list">
            <MacroProgress label="Protein" value={96} max={140} unit="g" />
            <MacroProgress label="Carbs" value={180} max={240} unit="g" />
            <MacroProgress label="Fats" value={42} max={70} unit="g" />
          </div>
        </div>
      </section>

      {/* Your Journey */}
      <section className="content-section">
        <h3 className="section-title">Your journey</h3>
        <div className="journey-cards">
          <button
            className="journey-card"
            onClick={() => onOpen('goals')}
          >
            <div className="journey-icon journey-icon-goals">
              <Icon name="target" size={18} />
            </div>
            <div className="journey-info">
              <div className="journey-title">Goals & milestones</div>
              <div className="journey-subtitle">Build muscle · 62% there</div>
            </div>
            <Icon name="arrow" size={14} />
          </button>
          <button
            className="journey-card"
            onClick={() => onOpen('progress')}
          >
            <div className="journey-icon journey-icon-progress">
              <Icon name="trend" size={18} />
            </div>
            <div className="journey-info">
              <div className="journey-title">Progress</div>
              <div className="journey-subtitle">+2.1 kg in 8 weeks</div>
            </div>
            <Icon name="arrow" size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}

function MissionCard({
  title,
  current,
  total
}: {
  title: string;
  current: number;
  total: number
}) {
  const percent = (current / total) * 100;

  return (
    <div className="mission-card">
      <div className="mission-header">
        <span className="mission-title">{title}</span>
        <span className="mission-count">{current} / {total}</span>
      </div>
      <div className="mission-bar">
        <div
          className="mission-bar-fill"
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
}

function MacroProgress({
  label,
  value,
  max,
  unit
}: {
  label: string;
  value: number;
  max: number;
  unit: string
}) {
  const percent = (value / max) * 100;

  return (
    <div className="macro-item">
      <div className="macro-header">
        <span className="macro-label">{label}</span>
        <span className="macro-values">{value} / {max} {unit}</span>
      </div>
      <div className="macro-bar">
        <div
          className="macro-bar-fill"
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
}
