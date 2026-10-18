'use client';
import { useState, useMemo } from 'react';
import type { Profile } from '../Home/types';
import MeEditLayout from './MeEditLayout';

type Props = {
  profile: Profile;
  onBack: () => void;
  onSave: (patch: Partial<Profile>) => Promise<boolean>;
  error?: string;
};

export default function PersonalDataEdit({ profile, onBack, onSave, error }: Props) {
  const [data, setData] = useState({
    name: profile.name || '',
    age: profile.age || '',
    height: profile.height || '',
    heightInches: profile.heightInches || '',
    weight: profile.weight || '',
    gender: profile.gender || '',
    chest: profile.chest || '',
    waist: profile.waist || '',
    arms: profile.arms || '',
    activity: profile.activity || '',
  });
  const [saving, setSaving] = useState(false);

  const isDirty = data.name !== (profile.name || '') ||
    data.age !== (profile.age || '') ||
    data.height !== (profile.height || '') ||
    data.heightInches !== (profile.heightInches || '') ||
    data.weight !== (profile.weight || '') ||
    data.gender !== (profile.gender || '') ||
    data.chest !== (profile.chest || '') ||
    data.waist !== (profile.waist || '') ||
    data.arms !== (profile.arms || '') ||
    data.activity !== (profile.activity || '');

  const bmi = useMemo(() => {
    const h = profile.heightUnit === 'ft & in.' ? (Number(data.height) * 12 + Number(data.heightInches)) * .0254 : Number(data.height) / 100;
    const w = Number(data.weight) * (profile.weightUnit === 'lb' || profile.weightUnit === 'lbs' ? .45359237 : 1);
    return h > 0 && w > 0 ? (w / (h * h)).toFixed(1) : '';
  }, [data.height, data.heightInches, data.weight, profile.heightUnit, profile.weightUnit]);

  const setField = (key: keyof typeof data, value: string) => setData(curr => ({ ...curr, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try { if (await onSave(data)) onBack(); } finally { setSaving(false); }
  };

  const activityOptions = ['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete'];

  return (
    <MeEditLayout
      title="Personal data"
      description="Used to size your plan and daily calorie targets."
      onBack={onBack}
      onDiscard={onBack}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={saving}
      error={error}
    >
      <label className="field">
        <span>Full name</span>
        <div className="input-wrap">
          <input value={data.name} onChange={e => setField('name', e.target.value)} autoComplete="name" maxLength={100} />
        </div>
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Age</span>
          <div className="input-wrap">
            <input type="number" inputMode="decimal" value={data.age} min={13} max={100} onChange={e => setField('age', e.target.value)} />
            <small>yrs</small>
          </div>
        </label>
        <label className="field height-field">
          <span>Height</span>
          <div className="input-wrap height-input-wrap">
            <input type="number" inputMode="decimal" value={data.height} min={profile.heightUnit === 'ft & in.' ? 2 : 80} max={profile.heightUnit === 'ft & in.' ? 8 : 250} onChange={e => setField('height', e.target.value)} />
            <small>{profile.heightUnit === 'ft & in.' ? 'ft' : 'cm'}</small>
            {profile.heightUnit === 'ft & in.' && <><input type="number" aria-label="Height inches" inputMode="decimal" min={0} max={11.9} step="0.1" value={data.heightInches} onChange={e => setField('heightInches', e.target.value)}/><small>in</small></>}
          </div>
        </label>
      </div>

      <label className="field">
        <span>Weight</span>
        <div className="input-wrap">
          <input type="number" inputMode="decimal" value={data.weight} min={25} max={350} step="0.1" onChange={e => setField('weight', e.target.value)} />
          <small>{profile.weightUnit || 'kg'}</small>
        </div>
      </label>
      <p className="bmi">{bmi ? `BMI ${bmi}` : 'BMI calculated from your height and weight'}</p>

      <div className="choice-group">
        <b>Gender</b>
        <div className="chips">
          {['Male', 'Female', 'Other'].map(option => (
            <button type="button" key={option} className={`chip ${data.gender === option ? 'active' : ''}`} aria-pressed={data.gender === option} onClick={() => setField('gender', option)}>{option}</button>
          ))}
        </div>
      </div>

      <div className="choice-group">
        <div className="group-title"><b>Body measurements</b><small>Optional</small></div>
        <div className="measure-grid">
          {(['Chest', 'Waist', 'Arms'] as const).map(label => {
            const key = label.toLowerCase() as 'chest' | 'waist' | 'arms';
            return (
              <label className="field" key={key}>
                <span>{label}</span>
                <div className="input-wrap">
                  <input type="number" inputMode="decimal" placeholder="—" value={data[key]} onChange={e => setField(key, e.target.value)} />
                  <small>{profile[`${key}Unit`] || profile.measurementUnit || 'cm'}</small>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="choice-group">
        <b>Activity level</b>
        <div className="chips">
          {activityOptions.map(option => (
            <button type="button" key={option} className={`chip ${data.activity === option ? 'active' : ''}`} aria-pressed={data.activity === option} onClick={() => setField('activity', option)}>{option}</button>
          ))}
        </div>
      </div>
    </MeEditLayout>
  );
}
