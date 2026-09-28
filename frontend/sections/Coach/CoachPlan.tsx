'use client';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { exercises } from './exercises';
import { Tag } from './ExerciseLibrary';

const days = ['M', 'T', 'W', 'Th', 'F', 'S', 'S'];
export default function CoachPlan({ profile, onStart, onLibrary }: { profile: Profile; onStart: () => void; onLibrary: () => void }) {
  const [selectedDay, setSelectedDay] = useState(0);
  return <><header className="coach-header"><h2>AI Coach</h2></header><div className="plan-week"><small>Week 3 · 4 sessions planned</small><div className="week-days">{days.map((day, i) => <button key={i} className={`${selectedDay === i ? 'selected' : ''} ${[0,2,4,5].includes(i) ? 'has-session' : ''}`} onClick={() => setSelectedDay(i)}><b>{day}</b>{[0,2,4,5].includes(i) && <i/>}</button>)}</div></div><section className="coach-today"><small>Today</small><h3>{selectedDay === 0 ? 'Upper Body — Push' : ['Upper Body — Push', 'Recovery day', 'Lower Body', 'Recovery day', 'Upper Body — Pull', 'Full Body', 'Rest day'][selectedDay]}</h3><p>{profile.duration || '45 min'} · 6 exercises · {profile.equipment?.join(', ') || 'Dumbbells'}</p></section><div className="coach-exercises">{exercises.slice(0,6).map((exercise,i)=><div className="coach-exercise" key={exercise.name}><span className="exercise-number">{i+1}</span><span className="coach-exercise-copy"><b>{exercise.name}</b><small>{exercise.sets}</small></span><Tag tag={exercise.tag}/></div>)}</div><section className="coach-tip"><Icon name="coach" size={16}/><div><small>Form tip · Dumbbell bench press</small><p>Keep your wrists stacked over your elbows and lower until your upper arms are level with the bench.</p></div></section><button className="library-link" onClick={onLibrary}><span className="journey-icon"><Icon name="medal" size={16}/></span><span><b>Exercise library</b><small>Demos and form guides</small></span><Icon name="arrow" size={16}/></button><footer className="coach-footer"><button className="primary" onClick={onStart}>▶&nbsp; Start session</button></footer></>;
}
