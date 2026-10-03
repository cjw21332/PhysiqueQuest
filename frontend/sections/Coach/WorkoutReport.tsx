'use client';

import { Icon } from '../Home/icons';

const performance = [
  ['Push-up','36 / 36 reps counted','94%'],
  ['Dumbbell bench press','37 / 40 reps counted','86%'],
  ['Overhead press','29 / 30 reps counted','90%'],
  ['Lateral raise','41 / 45 reps counted','79%']
];

const errors = [
  ['×7','Elbows flaring','Dumbbell bench press'],
  ['×4','Partial range of motion','Lateral raise'],
  ['×2','Hips sagging','Push-up']
];

export default function WorkoutReport({ duration, onHome, onShare }: { duration: number; onHome: () => void; onShare: () => void }) {
  const elapsed = `${Math.floor(duration/60).toString().padStart(2,'0')}:${(duration%60).toString().padStart(2,'0')}`;

  return (
    <>
      <header className="coach-header report-header">
        <h2>Workout report</h2>
        <button className="share-button" onClick={onShare}>
          <Icon name="trend" size={14}/> Share
        </button>
      </header>

      <div className="report-date">Nov 18 · 7:04 PM</div>
      <h3 className="report-title">Upper body — push</h3>

      <div className="report-summary">
        <div className="report-score">
          <b>88%</b>
          <small>form</small>
        </div>
        <div className="report-stats">
          <span>
            Duration
            <b>{elapsed === '00:00' ? '42:16' : elapsed}</b>
          </span>
          <span>
            Volume
            <b>4.2k kg</b>
          </span>
          <span>
            Burned
            <b>312 kcal</b>
          </span>
        </div>
      </div>

      <div className="mission-complete">
        <Icon name="dumbbell" size={16}/>
        <span>
          <b>+100 points</b> · "Complete one workout" mission done
        </span>
      </div>

      <section className="report-section">
        <h3>Per exercise</h3>
        {performance.map(([name, count, score]) => (
          <div className="performance-row" key={name}>
            <div>
              <b>{name}</b>
              <strong>{score}</strong>
            </div>
            <small>{count}</small>
            <div className="mission-track">
              <i className={score === '79%' ? 'orange' : ''} style={{width: score}}/>
            </div>
          </div>
        ))}
      </section>

      <section className="report-section">
        <h3>Top form errors</h3>
        {errors.map(([count, title, exercise]) => (
          <div className="form-error" key={title}>
            <b>{count}</b>
            <span>
              <strong>{title}</strong>
              <small>{exercise}</small>
            </span>
            <button onClick={onShare}>See fix</button>
          </div>
        ))}
      </section>

      <div className="personal-record">
        <span className="journey-icon">
          <Icon name="trophy" size={22}/>
        </span>
        <span>
          <small>New personal record</small>
          <b>Dumbbell bench press · 22 kg × 10</b>
          <small>Previous best 20 kg × 10</small>
        </span>
      </div>

      <footer className="coach-footer">
        <button className="primary" onClick={onHome}>Back to home</button>
      </footer>
    </>
  );
}
