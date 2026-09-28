'use client';

import type { Profile } from './types';
import { Icon } from './icons';

const milestones = [
  { label: '70 kg body weight', detail: 'Reached Oct 12', done: true },
  { label: 'Bench press 60 kg × 8', detail: 'Reached Nov 03', done: true },
  { label: '72 kg body weight', detail: 'In progress · 3.5 kg to go', done: 'current' as const },
  { label: 'Bench press 70 kg × 8', detail: 'Upcoming', done: false },
];
export default function GoalsMilestones({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const weight = Number(profile.weight) || 68.5;
  const target = Number(profile.targetWeight) || 74;
  const percent = 62;
  const unit = profile.weightUnit || 'kg';
  return <><header className="section-page-head"><h2>Goals</h2><button className="edit-link" onClick={onBack}>✎ Edit</button></header><section className="goal-hero"><small>Primary goal</small><div className="goal-hero-title"><h2>{profile.goal || 'Build muscle'}</h2><b>{percent}%</b></div><div className="goal-progress"><i style={{ width: `${percent}%` }}/></div><div className="goal-weights"><b>{weight} {unit} now</b><span>{target} {unit} target</span></div><small className="goal-date">Target date · March 2027 · 23 weeks left</small></section><section className="subsection"><div className="section-head"><h3>Milestones</h3><span>2 of 4 reached</span></div><div className="milestone-list">{milestones.map((item, i) => <div className={`milestone ${item.done === true ? 'done' : item.done === 'current' ? 'current' : ''}`} key={item.label}><span className="milestone-dot">{item.done === true ? <Icon name="check" size={12}/> : item.done === 'current' ? '·' : ''}</span><div><b>{item.label}</b><small>{item.detail}</small></div>{i < milestones.length - 1 && <i className="milestone-line"/>}</div>)}</div></section><section className="subsection secondary-goals"><h3>Secondary goals</h3><div className="secondary-goal"><span className="mini-progress">75%</span><div><b>Train 4× per week</b><small>3 of 4 workouts completed</small></div></div><div className="secondary-goal"><span className="mini-progress">50%</span><div><b>Improve form accuracy</b><small>Average score · 88%</small></div></div></section></>;
}
