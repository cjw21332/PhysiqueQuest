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

const conditionOptions = ['Knee injury', 'Lower back pain', 'Shoulder impingement', 'Hypertension', 'Asthma', 'Heart condition', 'None of these'];

export default function HealthProfileEdit({ profile, onBack, onSave, error }: Props) {
  const [data, setData] = useState({
    injuries: profile.injuries ?? [],
    healthRisks: profile.healthRisks ?? [],
    healthConsentAt: profile.healthConsentAt ?? null,
    conditions: profile.conditions || [],
    healthNotes: profile.healthNotes || '',
  });
  const [saving, setSaving] = useState(false);

  const isDirty = data.healthConsentAt !== (profile.healthConsentAt ?? null) ||
    JSON.stringify(data.injuries) !== JSON.stringify(profile.injuries ?? []) ||
    JSON.stringify(data.healthRisks) !== JSON.stringify(profile.healthRisks ?? []) || JSON.stringify(data.conditions) !== JSON.stringify(profile.conditions || []) ||
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
      description="Helps tailor exercise guidance to the conditions you select."
      onBack={onBack}
      onDiscard={onBack}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={saving}
      error={error}
    >
      <fieldset className="health-consent"><legend>Health data consent</legend>
        <p>Allow PhysiqueQuest to store your injuries and health risks and use them to adapt your workouts. Turning this off and saving clears these entries.</p>
        <label className="health-consent-toggle"><input type="checkbox" checked={Boolean(data.healthConsentAt)} onChange={({ target: { checked } }) => setData(current => checked
          ? { ...current, healthConsentAt: new Date().toISOString() }
          : { ...current, healthConsentAt: null, injuries: [], healthRisks: [] })}/> Allow health-based coaching</label>
      </fieldset>
      {data.healthConsentAt && (['injuries', 'healthRisks'] as const).map(field => <fieldset key={field}><legend>{field === 'injuries' ? 'Injuries' : 'Health risks'}</legend>
        {Array.from(new Set([...(field === 'injuries' ? conditionOptions.slice(0, 3) : conditionOptions.slice(3, 6)), ...data[field]])).map(label => <label key={label} className="condition-checkbox">
          <input type="checkbox" checked={data[field].includes(label)} onChange={() => setData(curr => ({ ...curr, [field]: curr[field].includes(label) ? curr[field].filter(item => item !== label) : [...curr[field], label] }))}/>{label}</label>)}
      </fieldset>)}
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
        <p>Exercises involving a flagged area may receive a caution tag or be excluded from new plans. This does not guarantee an exercise is safe for you.</p>
      </div>

      <div className="choice-group notes-group">
        <div className="group-title"><b>Additional information</b><small>Optional</small></div>
        <textarea value={data.healthNotes} onChange={e => setField('healthNotes', e.target.value)} maxLength={500} placeholder="Recent surgery, medication, anything your coach should know" />
      </div>
    </MeEditLayout>
  );
}
