'use client';
import { useState } from 'react';
import type { Profile } from '../Home/types';
import MeEditLayout from './MeEditLayout';
import { Icon } from '../Home/icons';

type Props = {
  profile: Profile;
  onBack: () => void;
  onSave: (patch: Partial<Profile>) => Promise<void>;
};

const equipmentOptions = ['Bodyweight only', 'Dumbbells', 'Resistance bands', 'Full gym'];
const dayOptions = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function TrainingPreferenceEdit({ profile, onBack, onSave }: Props) {
  const [data, setData] = useState({
    equipment: profile.equipment || [],
    days: profile.days || [],
    duration: profile.duration || '',
    placementConfirmed: true, // We can default this or read from profile
  });
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(data.equipment) !== JSON.stringify(profile.equipment || []) ||
    JSON.stringify(data.days) !== JSON.stringify(profile.days || []) ||
    data.duration !== (profile.duration || '');

  const setField = (key: keyof typeof data, value: any) => setData(curr => ({ ...curr, [key]: value }));

  const toggleEquipment = (value: string) => setData(curr => {
    const equipment = curr.equipment.includes(value)
      ? curr.equipment.filter(item => item !== value)
      : [...curr.equipment, value];
    return { ...curr, equipment };
  });

  const toggleDay = (index: number) => {
    const dayId = `${dayOptions[index]}-${index}`;
    setData(curr => ({
      ...curr,
      days: curr.days.includes(dayId) ? curr.days.filter(day => day !== dayId) : [...curr.days, dayId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(data);
    setSaving(false);
    onBack();
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
        <div className="group-title"><b>Training days</b><small>{data.days.length} selected</small></div>
        <div className="day-grid">
          {dayOptions.map((day, index) => {
            const selected = data.days.includes(`${day}-${index}`);
            return <button type="button" key={`${day}-${index}`} className={`day ${selected ? 'active' : ''}`} aria-pressed={selected} onClick={() => toggleDay(index)}>{day}</button>;
          })}
        </div>
      </div>

      <div className="choice-group">
        <b>Session duration</b>
        <div className="chips">
          {['20', '30', '45', '60'].map(val => {
            const option = `${val} min`;
            // Some profiles might store "20", some "20 min". Handle safely:
            const isActive = data.duration === option || data.duration === val;
            return <button type="button" key={val} className={`chip ${isActive ? 'active' : ''}`} aria-pressed={isActive} onClick={() => setField('duration', option)}>{val}</button>;
          })}
        </div>
      </div>

      <div className="placement-card">
        <span className="phone-icon"><Icon name="phone" size={18} /></span>
        <div><b>Phone placement for form tracking</b><p>Prop your phone at waist height, 2.5–3.0 m away, so your full body stays in frame.</p></div>
      </div>
    </MeEditLayout>
  );
}
