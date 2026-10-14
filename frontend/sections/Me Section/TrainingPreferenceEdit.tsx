'use client';
import { useState } from 'react';
import type { Profile } from '../Home/types';
import MeEditLayout from './MeEditLayout';
import { Icon } from '../Home/icons';
import { formatTrainingDays, normalizeTrainingDays, TRAINING_DAYS } from '../../lib/trainingDays';

type Props = {
  profile: Profile;
  onBack: () => void;
  onSave: (patch: Partial<Profile>) => Promise<boolean>;
  error?: string;
};

const equipmentOptions = ['Bodyweight only', 'Dumbbells', 'Resistance bands', 'Full gym'];

export default function TrainingPreferenceEdit({ profile, onBack, onSave, error }: Props) {
  const [data, setData] = useState({
    equipment: profile.equipment || [],
    days: normalizeTrainingDays(profile.days || []),
    duration: profile.duration || '',
  });
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  const isDirty = JSON.stringify(data.equipment) !== JSON.stringify(profile.equipment || []) ||
    JSON.stringify(data.days) !== JSON.stringify(normalizeTrainingDays(profile.days || [])) ||
    data.duration !== (profile.duration || '');

  const setDuration = (value: string) => setData(curr => ({ ...curr, duration: value }));

  const toggleEquipment = (value: string) => setData(curr => {
    const equipment = curr.equipment.includes(value)
      ? curr.equipment.filter(item => item !== value)
      : [...curr.equipment, value];
    return { ...curr, equipment };
  });

  const toggleDay = (day: string) => {
    setData(curr => ({
      ...curr,
      days: curr.days.includes(day) ? curr.days.filter(selected => selected !== day) : [...curr.days, day],
    }));
  };

  const handleSave = async () => {
    setValidationError('');
    if (data.days.length === 0) {
      setValidationError('Choose at least one training day.');
      return;
    }

    setSaving(true);
    try {
      if (await onSave({ ...data, days: normalizeTrainingDays(data.days) })) onBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <MeEditLayout
      title="Training preference"
      description="Your plan is built around what you actually have."
      onBack={onBack}
      onDiscard={onBack}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={saving}
      error={validationError || error}
    >
      <div className="choice-group training-equipment">
        <div className="group-title"><b>Equipment available</b></div>
        <div className="equipment-grid">
          {equipmentOptions.map(option => {
            const selected = data.equipment.includes(option);
            return <button type="button" key={option} className={`equipment ${selected ? 'on' : ''}`} aria-pressed={selected} onClick={() => toggleEquipment(option)}><span className="checkbox">{selected ? '✓' : ''}</span>{option}</button>;
          })}
        </div>
      </div>

      <div className="choice-group">
        <div className="group-title"><b>Training days</b><small>{data.days.length} selected<span className="visually-hidden">{formatTrainingDays(data.days) || 'None selected'}</span></small></div>
        <div className="day-grid">
          {TRAINING_DAYS.map(day => {
            const selected = data.days.includes(day.value);
            return <button type="button" key={day.value} className={`day ${selected ? 'active' : ''}`} aria-label={day.value} aria-pressed={selected} onClick={() => toggleDay(day.value)}>{day.label.slice(0, 1)}</button>;
          })}
        </div>
      </div>

      <div className="choice-group">
        <b>Session duration</b>
        <div className="chips duration-chips">
          {['20', '30', '45', '60'].map(val => {
            const option = `${val} min`;
            // Some profiles might store "20", some "20 min". Handle safely:
            const isActive = data.duration === option || data.duration === val;
            return <button type="button" key={val} className={`chip ${isActive ? 'active' : ''}`} aria-pressed={isActive} onClick={() => setDuration(option)}>{val}</button>;
          })}
        </div>
      </div>

      <div className="placement-card">
        <span className="phone-icon"><Icon name="phone-device" size={18} /></span>
        <div><b>Phone placement for form tracking</b><p>Prop your phone at waist height, 2.5–3.0 m away, so your full body stays in frame.</p></div>
      </div>
    </MeEditLayout>
  );
}
