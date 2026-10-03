'use client';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { exercises } from './exercises';

const days = [
  { label: 'M', key: 0 },
  { label: 'T', key: 1 },
  { label: 'W', key: 2 },
  { label: 'T', key: 3 },
  { label: 'F', key: 4 },
  { label: 'S', key: 5 },
  { label: 'S', key: 6 }
];

const scheduledDays = [0, 2, 4, 5]; // Days with planned workouts

export default function CoachPlan({
  profile,
  onStart,
  onLibrary
}: {
  profile: Profile;
  onStart: () => void;
  onLibrary: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState(0);

  const workoutTitles = [
    'Upper Body — Push',
    'Recovery day',
    'Lower Body',
    'Recovery day',
    'Upper Body — Pull',
    'Full Body',
    'Rest day'
  ];

  const currentWorkout = workoutTitles[selectedDay];
  const isWorkoutDay = scheduledDays.includes(selectedDay);

  // Sample exercises for the workout
  const todayExercises = [
    { name: 'Push-up', sets: '3 × 12', tracking: 'AI tracked' },
    { name: 'Dumbbell bench press', sets: '4 × 10 · 22 kg', tracking: 'AI tracked' },
    { name: 'Overhead press', sets: '3 × 10 · 16 kg', tracking: 'AI tracked' },
    { name: 'Lateral raise', sets: '3 × 15 · 6 kg', tracking: 'AI tracked' },
    { name: 'Triceps extension', sets: '3 × 12 · 10 kg', tracking: 'Manual' },
    { name: 'Plank', sets: '3 × 45 s', tracking: 'AI tracked' }
  ];

  return (
    <div className="coach-plan">
      {/* Header */}
      <header className="coach-plan-header">
        <h2 className="coach-title">AI Coach</h2>
      </header>

      {/* Week Plan Card */}
      <section className="week-section">
        <div className="week-info">Week 3 · 4 sessions planned</div>
        <div className="week-days-grid">
          {days.map((day, index) => {
            const hasSession = scheduledDays.includes(index);
            const isSelected = selectedDay === index;

            return (
              <button
                key={index}
                className={`day-button ${isSelected ? 'selected' : ''} ${
                  hasSession ? 'has-session' : ''
                }`}
                onClick={() => setSelectedDay(index)}
              >
                <span className="day-label">{day.label}</span>
                {hasSession && <div className="day-dot" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Today's Workout */}
      {isWorkoutDay ? (
        <>
          <section className="workout-info-card">
            <div className="workout-label">Today</div>
            <h3 className="workout-title">{currentWorkout}</h3>
            <div className="workout-meta">
              <span className="meta-item">{profile.duration || '45 min'}</span>
              <span className="meta-separator">·</span>
              <span className="meta-item">{todayExercises.length} exercises</span>
              <span className="meta-separator">·</span>
              <span className="meta-item">{profile.equipment?.[0] || 'Dumbbells'}</span>
            </div>
          </section>

          {/* Exercise List Card */}
          <section className="exercise-list-card">
            <div className="exercise-list-header">
              <h4>Exercises</h4>
              <span className="exercise-count">{todayExercises.length}</span>
            </div>
            <div className="exercise-list">
              {todayExercises.map((exercise, index) => (
                <div key={index} className="exercise-item">
                  <div className="exercise-number">{index + 1}</div>
                  <div className="exercise-details">
                    <div className="exercise-name">{exercise.name}</div>
                    <div className="exercise-sets">{exercise.sets}</div>
                  </div>
                  <div
                    className={`tracking-badge ${
                      exercise.tracking === 'AI tracked' ? 'ai-tracked' : 'manual'
                    }`}
                  >
                    {exercise.tracking}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Form Tip Card */}
          <div className="form-tip-card">
            <div className="tip-icon">
              <Icon name="coach" size={20} />
            </div>
            <div className="tip-content">
              <div className="tip-title">Form tip</div>
              <div className="tip-exercise">Dumbbell bench press</div>
              <div className="tip-text">
                Keep your wrists stacked over your elbows and lower until your upper arms are level with the bench.
              </div>
            </div>
          </div>

          {/* Exercise Library Link */}
          <button className="library-link-card" onClick={onLibrary}>
            <div className="library-icon">
              <Icon name="medal" size={22} />
            </div>
            <div className="library-info">
              <div className="library-title">Exercise library</div>
              <div className="library-subtitle">Demos and form guides</div>
            </div>
            <Icon name="arrow" size={18} />
          </button>

          {/* Start Button */}
          <div className="start-button-container">
            <button className="start-session-btn" onClick={onStart}>
              <Icon name="play" size={18} />
              Start session
            </button>
          </div>
        </>
      ) : (
        <div className="rest-day-message">
          <h3>{currentWorkout}</h3>
          <p>No workout scheduled for this day. Rest and recover!</p>
        </div>
      )}
    </div>
  );
}
