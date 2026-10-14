'use client';
import { useState } from 'react';
import type { Profile } from '../Home/types';
import MeEditLayout from './MeEditLayout';
import { Icon } from '../Home/icons';

type Props = {
  profile: Profile;
  onBack: () => void;
  onSave: (patch: Partial<Profile>) => Promise<boolean>;
  error?: string;
};

const goalOptions = [
  { title: 'Weight loss', detail: 'Calorie deficit + conditioning', icon: 'weight-loss' },
  { title: 'Build muscle', detail: 'Hypertrophy split, higher protein', icon: 'library-dumbbells' },
  { title: 'Strength', detail: 'Low reps, progressive overload', icon: 'strength' },
  { title: 'Endurance', detail: 'Circuit and interval focus', icon: 'pulse' },
  { title: 'General fitness', detail: 'Balanced weekly plan', icon: 'health' },
];

export default function GoalsEdit({ profile, onBack, onSave, error }: Props) {
  const [data, setData] = useState({
    goal: profile.goal || '',
    targetWeight: profile.targetWeight || '',
    targetDate: profile.targetDate || '',
    seriousness: profile.seriousness || '',
  });
  const [saving, setSaving] = useState(false);

  const isDirty = data.goal !== (profile.goal || '') ||
    data.targetWeight !== (profile.targetWeight || '') ||
    data.targetDate !== (profile.targetDate || '') ||
    data.seriousness !== (profile.seriousness || '');

  const setField = (key: keyof typeof data, value: string) => setData(curr => ({ ...curr, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try { if (await onSave(data)) onBack(); } finally { setSaving(false); }
  };

  return (
    <MeEditLayout
      title="Goals"
      description="Pick one primary goal. Your plan and calorie target follow it."
      onBack={onBack}
      onDiscard={onBack}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={saving}
      error={error}
    >
      <div className="goal-list">
        {goalOptions.map(option => (
          <button type="button" key={option.title} className={`goal-card ${data.goal === option.title ? 'chosen' : ''}`} aria-pressed={data.goal === option.title} onClick={() => setField('goal', option.title)}>
            <span className="goal-icon"><Icon name={option.icon} size={20} /></span>
            <span className="goal-copy"><b>{option.title}</b><small>{option.detail}</small></span>
            <span className={`radio ${data.goal === option.title ? 'checked' : ''}`} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="field-grid target-grid">
        <label className="field">
          <span>Target weight</span>
          <div className="input-wrap">
            <input type="number" inputMode="decimal" value={data.targetWeight} min={25} max={350} step="0.1" onChange={e => setField('targetWeight', e.target.value)} />
            <small>{profile.weightUnit || 'kg'}</small>
          </div>
        </label>
        <label className="field">
          <span>Target date</span>
          <div className="input-wrap">
            <input type="date" value={data.targetDate} onChange={e => setField('targetDate', e.target.value)} aria-label="Target date" />
          </div>
        </label>
      </div>

      <div className="choice-group">
        <b>How serious are you?</b>
        <div className="chips">
          {['Casual', 'Consistent', 'Hardcore'].map(option => (
            <button type="button" key={option} className={`chip ${data.seriousness === option ? 'active' : ''}`} aria-pressed={data.seriousness === option} onClick={() => setField('seriousness', option)}>{option}</button>
          ))}
        </div>
      </div>
    </MeEditLayout>
  );
}
