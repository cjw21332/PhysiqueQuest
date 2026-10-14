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

const conditionOptions = ['Knee injury', 'Lower back pain', 'Shoulder impingement', 'Hypertension', 'Asthma', 'None of these'];

export default function HealthProfileEdit({ profile, onBack, onSave, error }: Props) {
  const [data, setData] = useState({
    conditions: profile.conditions || [],
    healthNotes: profile.healthNotes || '',
  });
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(data.conditions) !== JSON.stringify(profile.conditions || []) ||
    data.healthNotes !== (profile.healthNotes || '');

  const setField = (key: keyof typeof data, value: any) => setData(curr => ({ ...curr, [key]: value }));

  const toggleCondition = (value: string) => setData(curr => {
    if (value === 'None of these') return { ...curr, conditions: curr.conditions.includes(value) ? [] : [value] };
    const conditions = curr.conditions.filter(item => item !== 'None of these');
    return { ...curr, conditions: conditions.includes(value) ? conditions.filter(item => item !== value) : [...conditions, value] };
  });

  const handleSave = async () => {
    setSaving(true);
    try { if (await onSave(data)) onBack(); } finally { setSaving(false); }
  };

  return (
    <MeEditLayout
      title="Health profile"
      description="Keeps unsafe exercises out of your plan."
      onBack={onBack}
      onDiscard={onBack}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={saving}
      error={error}
    >
      <div className="choice-group condition-list">
        <div className="group-title"><b>Existing conditions</b></div>
        {conditionOptions.map(condition => (
          <label key={condition} className="condition-checkbox">
            <input type="checkbox" checked={data.conditions.includes(condition)} onChange={() => toggleCondition(condition)} />
            {condition}
          </label>
        ))}
      </div>

      <div className="safety-note">
        <span><Icon name="shield" size={16} /></span>
        <p>Exercises that load a flagged area get a caution tag in your library and are swapped out of new plans.</p>
      </div>

      <div className="choice-group notes-group">
        <div className="group-title"><b>Additional information</b><small>Optional</small></div>
        <textarea value={data.healthNotes} onChange={e => setField('healthNotes', e.target.value)} maxLength={500} placeholder="Recent surgery, medication, anything your coach should know" />
      </div>
    </MeEditLayout>
  );
}
