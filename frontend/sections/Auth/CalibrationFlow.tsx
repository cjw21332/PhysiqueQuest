'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';
import { formatPhoneNumber, unformatPhoneNumber } from '../../lib/phoneFormatter';
import { normalizeTrainingDays, TRAINING_DAYS } from '../../lib/trainingDays';
import { calibrationDraftKey, readCalibrationDraft } from '../../lib/calibrationDraft';

type CalibrationData = {
  age: string;
  height: string;
  heightInches: string;
  heightUnit: 'cm' | 'ft & in.';
  weight: string;
  weightUnit: 'kg' | 'lbs';
  gender: string;
  chest: string;
  chestUnit: 'cm' | 'inch';
  waist: string;
  waistUnit: 'cm' | 'inch';
  arms: string;
  armsUnit: 'cm' | 'inch';
  activity: string;
  goal: string;
  targetWeight: string;
  targetDate: string;
  seriousness: string;
  equipment: string[];
  days: string[];
  duration: string;
  placementConfirmed: boolean;
  conditions: string[];
  healthNotes: string;
  contactName: string;
  contactPhone: string;
};

const initialData: CalibrationData = {
  age: '', height: '', heightInches: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', gender: '', chest: '', chestUnit: 'cm', waist: '', waistUnit: 'cm', arms: '', armsUnit: 'cm', activity: '',
  goal: '', targetWeight: '', targetDate: '', seriousness: '',
  equipment: [], days: [], duration: '', placementConfirmed: false,
  conditions: [], healthNotes: '', contactName: '', contactPhone: '',
};

const goalOptions = [
  { title: 'Weight loss', detail: 'Work toward your weight goal', icon: 'weight-loss' },
  { title: 'Build muscle', detail: 'Resistance training for muscle growth', icon: 'dumbbell' },
  { title: 'Strength', detail: 'Strength-focused exercise choices', icon: 'strength' },
  { title: 'Endurance', detail: 'Cardio and conditioning sessions', icon: 'pulse' },
  { title: 'General fitness', detail: 'Balanced weekly plan', icon: 'health' },
];
const equipmentOptions = ['Bodyweight only', 'Dumbbells', 'Resistance bands', 'Full gym'];
const activityOptions = ['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete'];
const conditionOptions = ['Knee injury', 'Lower back pain', 'Shoulder impingement', 'Hypertension', 'Asthma', 'None of these'];

export default function CalibrationFlow({ name, email, onComplete, submitError = '' }: {
  name: string;
  email: string;
  onComplete: (profile: Profile) => void | Promise<void>;
  submitError?: string;
}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CalibrationData>(initialData);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [draftError, setDraftError] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const draftKey = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    draftKey.current = calibrationDraftKey();
    const draft = readCalibrationDraft(initialData);
    if (draft) { setData(draft.data); setStep(draft.step); setSkipped(draft.skipped); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      const key = draftKey.current;
      if (!key || key !== calibrationDraftKey()) throw new Error('Account changed');
      localStorage.setItem(key, JSON.stringify({ version: 1, data, step, skipped }));
      setDraftError(false);
    } catch { setDraftError(true); }
  }, [data, step, skipped, ready]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); if (ready) headingRef.current?.focus(); }, [step, ready]);
  const skip = (section: string, fields: Partial<CalibrationData>) => {
    setData(current => ({ ...current, ...fields })); setSkipped(current => [...current, section]); setError('');
  };
  const restore = (section: string) => setSkipped(current => current.filter(item => item !== section));

  const bmi = useMemo(() => {
    const heightMeters = heightInMeters(data.height, data.heightInches, data.heightUnit);
    const weight = data.weightUnit === 'lbs' ? Number(data.weight) / 2.2046226218 : Number(data.weight);
    return heightMeters > 0 && weight > 0 ? (weight / (heightMeters * heightMeters)).toFixed(1) : '';
  }, [data.height, data.heightInches, data.heightUnit, data.weight, data.weightUnit]);

  const setField = <K extends keyof CalibrationData>(key: K, value: CalibrationData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const toggleEquipment = (value: string) => setData((current) => {
    const equipment = current.equipment.includes(value)
      ? current.equipment.filter((item) => item !== value)
      : [...current.equipment, value];
    return { ...current, equipment };
  });

  const toggleCondition = (value: string) => setData((current) => {
    if (value === 'None of these') return { ...current, conditions: current.conditions.includes(value) ? [] : [value] };
    const conditions = current.conditions.filter((item) => item !== 'None of these');
    return { ...current, conditions: conditions.includes(value) ? conditions.filter((item) => item !== value) : [...conditions, value] };
  });

  const toggleDay = (index: number) => {
    const dayId = TRAINING_DAYS[index].legacyId;
    setData((current) => ({
      ...current,
      days: current.days.includes(dayId) ? current.days.filter((day) => day !== dayId) : [...current.days, dayId],
    }));
  };

  async function submitStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || submitting.current) return;
    if (!draftKey.current || draftKey.current !== calibrationDraftKey()) { setError('Your account or connection changed. Reopen registration to continue with the correct account.'); return; }
    setError('');
    if (step === 1) {
      const age = Number(data.age);
      const heightCm = heightInMeters(data.height, data.heightInches, data.heightUnit) * 100;
      const weightKg = data.weightUnit === 'lbs' ? Number(data.weight) / 2.2046226218 : Number(data.weight);
      const heightPartsValid = data.heightUnit === 'cm'
        ? data.height.trim() !== ''
        : data.height.trim() !== '' && Number(data.height) >= 2 && Number(data.height) <= 8 && Number(data.heightInches) >= 0 && Number(data.heightInches) < 12;
      if (!age || age < 13 || age > 100) { setError('Enter an age between 13 and 100.'); return; }
      if (!heightPartsValid || !Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250) { setError('Enter a height between 80 and 250 cm (2 ft 7 in. to 8 ft 2 in.).'); return; }
      if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 350) { setError('Enter a weight between 25 and 350 kg (55 to 772 lbs).'); return; }
      if (!data.gender) { setError('Select your gender.'); return; }
      if (!data.activity) { setError('Select your activity level.'); return; }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!data.goal) { setError('Choose a primary training goal.'); return; }
      if (!data.seriousness) { setError('Choose your training commitment level.'); return; }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!data.equipment.length) { setError('Choose at least one available equipment option.'); return; }
      if (!data.days.length) { setError('Choose at least one training day.'); return; }
      if (!data.duration) { setError('Choose a session duration.'); return; }
      setStep(4);
      return;
    }
    if (!data.contactName.trim() || !data.contactPhone.trim()) {
      setError('Add an emergency contact name and mobile number to continue.');
      return;
    }

    const days = normalizeTrainingDays(data.days);
    submitting.current = true; setSaving(true);
    try { await onComplete({
      name: name.trim(), email: email.trim(), age: data.age, gender: data.gender,
      height: data.height, heightInches: data.heightInches, heightUnit: data.heightUnit,
      weight: data.weight, weightUnit: data.weightUnit,
      chest: data.chest, chestUnit: data.chestUnit,
      waist: data.waist, waistUnit: data.waistUnit,
      arms: data.arms, armsUnit: data.armsUnit,
      activity: data.activity,
      goal: data.goal, targetWeight: data.targetWeight, targetDate: data.targetDate,
      seriousness: data.seriousness, equipment: data.equipment, days,
      duration: data.duration, conditions: data.conditions, healthNotes: data.healthNotes.trim(),
      contactName: data.contactName.trim(), contactPhone: data.contactPhone.trim(),
    }); } finally { submitting.current = false; setSaving(false); }
  }

  const clearBasicInfo = () => {
    setData((current) => ({ ...current, age: '', height: '', heightInches: '', weight: '', gender: '', chest: '', waist: '', arms: '', activity: '' }));
  };

  const clearGoals = () => {
    setData((current) => ({ ...current, goal: '', targetWeight: '', targetDate: '', seriousness: '' }));
  };

  const clearEquipment = () => {
    setData((current) => ({ ...current, equipment: [] }));
  };

  const clearTrainingDays = () => {
    setData((current) => ({ ...current, days: [] }));
  };

  const clearSessionInfo = () => {
    setData((current) => ({ ...current, duration: '', placementConfirmed: false }));
  };

  const clearHealthInfo = () => {
    setData((current) => ({ ...current, conditions: [], healthNotes: '', contactName: '', contactPhone: '' }));
  };

  const stepTitles = ['Personal data', 'What are you training for?', 'Training preference', 'Health & safety'];
  const continueLabels = ['Next: Goals', 'Next: Training', 'Next: Health info', 'Save profile & continue'];

  return (
    <section className="wizard calibration-wizard" aria-label={`Calibration step ${step} of 4`}>
      <div className="progress" role="img" aria-label={`Step ${step} of 4`}>
        {stepTitles.map((title, index) => <i key={title} className={index < step ? 'filled' : ''} />)}
      </div>
      <form className="calibration-form" onSubmit={submitStep} aria-busy={saving}>
        <fieldset className="calibration-fields" disabled={!ready || saving}>
        <div className="calibration-scroll" ref={scrollRef}>
      <div className="wizard-heading">
        <div className="step-header">
          <small>Step {step} of 4 · Calibration</small>
          {step > 1 && (
            <button type="button" className="ghost back-link" onClick={() => { setError(''); setStep(step - 1); }}>
              <span className="back-link-icon"><Icon name="arrow" size={14} /></span>
              Back
            </button>
          )}
        </div>
        <h2 ref={headingRef} tabIndex={-1}>{stepTitles[step - 1]}</h2>
        <p className="calibration-draft-status" role="status">{!ready ? 'Loading your progress…' : draftError ? 'Device storage is unavailable. Keep this page open to avoid losing progress.' : 'Progress saved on this device for your account. Reopen registration to continue. Your profile is sent when you finish.'}</p>
        <p>{step === 1 ? 'Save your starting measurements. Nutrition targets currently use shared defaults.' : step === 2 ? 'Choose a goal to track. You can update it later.' : step === 3 ? 'Choose equipment, training days and session length for your plan.' : 'Add health notes and an emergency contact to your profile.'}</p>
      </div>

        <div className="step-content">
          {step === 1 && <>
            <div className="section-header">
              <div className="group-title"><b>Basic information</b></div>
              <button type="button" className="ghost clear-section-btn" onClick={clearBasicInfo}>Clear</button>
            </div>
            <div className="field-grid">
              <NumberField label="Age" value={data.age} suffix="yrs" min={13} max={100} onChange={(value) => setField('age', value)} />
              <label className="field height-field"><span>Height</span><div className="input-wrap height-input-wrap">
                {data.heightUnit === 'cm' ? <input type="number" inputMode="decimal" value={data.height} min={80} max={250} onChange={(event) => setField('height', event.target.value)} aria-label="Height" /> : <div className="height-imperial-inputs"><input type="number" inputMode="numeric" value={data.height} min={2} max={8} onChange={(event) => setField('height', event.target.value)} aria-label="Height in feet"/><small>ft</small><input type="number" inputMode="decimal" value={data.heightInches} min={0} max={11.9} step="0.1" onChange={(event) => setField('heightInches', event.target.value)} aria-label="Height in inches"/><small>in</small></div>}
                <select className="unit-suffix-select" aria-label="Height unit" value={data.heightUnit} onChange={(event) => { const unit = event.target.value as CalibrationData['heightUnit']; const totalInches = data.heightUnit === 'cm' ? Number(data.height) / 2.54 : Number(data.height) * 12 + Number(data.heightInches || 0); if (unit === 'cm') { setField('height', data.height ? (totalInches * 2.54).toFixed(1) : ''); setField('heightInches', ''); } else { setField('height', data.height ? String(Math.floor(totalInches / 12)) : ''); setField('heightInches', data.height ? (totalInches % 12).toFixed(1) : ''); } setField('heightUnit', unit); }}><option value="cm">cm</option><option value="ft &amp; in.">ft &amp; in.</option></select>
              </div></label>
            </div>
            <UnitNumberField label="Weight" value={data.weight} unit={data.weightUnit} units={['kg', 'lbs']} min={data.weightUnit === 'kg' ? 25 : 55} max={data.weightUnit === 'kg' ? 350 : 772} step="0.1" onChange={(value) => setField('weight', value)} onUnitChange={(unit) => { const convert = (value: string) => value ? (unit === 'lbs' ? Number(value) * 2.2046226218 : Number(value) / 2.2046226218).toFixed(1) : ''; setField('weight', convert(data.weight)); setField('targetWeight', convert(data.targetWeight)); setField('weightUnit', unit as CalibrationData['weightUnit']); }} />
            <p className="bmi">{bmi ? `BMI ${bmi}` : 'BMI calculated from your height and weight'}</p>
            <ChoiceGroup label="Gender" options={['Male', 'Female', 'Other']} value={data.gender} onChange={(value) => setField('gender', value)} />
            <div className="choice-group">
              <div className="group-title"><b>Body measurements</b><small>Optional</small></div>
              <button type="button" className="ghost calibration-skip" onClick={()=>skipped.includes('measurements') ? restore('measurements') : skip('measurements', { chest: '', waist: '', arms: '' })}>{skipped.includes('measurements') ? 'Add body measurements' : 'Skip body measurements'}</button>
              {!skipped.includes('measurements') && <div className="measure-grid">
                {(['Chest', 'Waist', 'Arms'] as const).map((label) => {
                  const key = label.toLowerCase() as 'chest' | 'waist' | 'arms';
                  const unitKey = `${key}Unit` as 'chestUnit' | 'waistUnit' | 'armsUnit';
                  const currentUnit = data[unitKey];
                  return <UnitNumberField
                    key={key}
                    label={label}
                    value={data[key]}
                    unit={currentUnit}
                    units={['cm', 'inch']}
                    min={1}
                    max={currentUnit === 'cm' ? (key === 'arms' ? 150 : 250) : (key === 'arms' ? 59 : 98)}
                    onChange={(value) => setField(key, value)}
                    onUnitChange={(unit) => {
                      const factor = unit === 'inch' ? 1 / 2.54 : 2.54;
                      setField(key, data[key] ? (Number(data[key]) * factor).toFixed(1) : '');
                      setField(unitKey, unit as CalibrationData['chestUnit']);
                    }}
                  />;
                })}
              </div>}
            </div>
            <ChoiceGroup label="Activity level" options={activityOptions} value={data.activity} onChange={(value) => setField('activity', value)} />
            <p className="microcopy">{activityDescription(data.activity)}</p>
          </>}

          {step === 2 && <>
            <div className="section-header">
              <div className="group-title"><b>Training goals</b></div>
              <button type="button" className="ghost clear-section-btn" onClick={clearGoals}>Clear</button>
            </div>
            <div className="goal-list">
              {goalOptions.map((option) => (
                <button type="button" key={option.title} className={`goal-card ${data.goal === option.title ? 'chosen' : ''}`} aria-pressed={data.goal === option.title} onClick={() => setField('goal', option.title)}>
                  <span className={`goal-icon goal-icon-${option.icon}`}><Icon name={option.icon} size={20} /></span>
                  <span className="goal-copy"><b>{option.title}</b><small>{option.detail}</small></span>
                  <span className={`radio ${data.goal === option.title ? 'checked' : ''}`} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="group-title"><b>Weight target & date</b><small>Optional</small></div>
            <button type="button" className="ghost calibration-skip" onClick={()=>skipped.includes('targets') ? restore('targets') : skip('targets', { targetWeight: '', targetDate: '' })}>{skipped.includes('targets') ? 'Add weight target & date' : 'Skip weight target & date'}</button>
            {!skipped.includes('targets') && <div className="field-grid target-grid">
              <UnitNumberField label="Target weight" value={data.targetWeight} unit={data.weightUnit} units={['kg', 'lbs']} min={data.weightUnit === 'kg' ? 25 : 55} max={data.weightUnit === 'kg' ? 350 : 772} step="0.1" onChange={(value) => setField('targetWeight', value)} onUnitChange={(unit) => { const convert = (value: string) => value ? (unit === 'lbs' ? Number(value) * 2.2046226218 : Number(value) / 2.2046226218).toFixed(1) : ''; setField('targetWeight', convert(data.targetWeight)); setField('weight', convert(data.weight)); setField('weightUnit', unit as CalibrationData['weightUnit']); }} />
              <label className="field"><span>Target date</span><div className="input-wrap"><input type="date" value={data.targetDate} onChange={(event) => setField('targetDate', event.target.value)} aria-label="Target date" /></div></label>
            </div>}
            <ChoiceGroup label="Training commitment" options={['Casual', 'Consistent', 'Hardcore']} value={data.seriousness} onChange={(value) => setField('seriousness', value)} />
            <p className="microcopy">{data.seriousness ? 'Saved with your profile. Your schedule and session length shape your plan.' : 'Choose the commitment level that best describes you.'}</p>
          </>}

          {step === 3 && <>
            <div className="choice-group training-equipment">
              <div className="section-header">
                <div className="group-title"><b>Equipment available</b></div>
                <button type="button" className="ghost clear-section-btn" onClick={clearEquipment}>Clear</button>
              </div>
              <div className="equipment-grid">
                {equipmentOptions.map((option) => {
                  const selected = data.equipment.includes(option);
                  return <button type="button" key={option} className={`equipment ${selected ? 'on' : ''}`} aria-pressed={selected} onClick={() => toggleEquipment(option)}><span className="checkbox">{selected ? '✓' : ''}</span>{option}</button>;
                })}
              </div>
            </div>
            <div className="choice-group">
              <div className="section-header">
                <div className="group-title"><b>Training days</b><small>{data.days.length} selected</small></div>
                <button type="button" className="ghost clear-section-btn" onClick={clearTrainingDays}>Clear</button>
              </div>
              <div className="day-grid">
                {TRAINING_DAYS.map((day, index) => {
                  const selected = data.days.includes(day.legacyId);
                  return <button type="button" key={day.value} className={`day ${selected ? 'active' : ''}`} aria-label={`${day.value}${selected ? ', selected' : ''}`} aria-pressed={selected} onClick={() => toggleDay(index)}>{day.value.charAt(0)}</button>;
                })}
              </div>
            </div>
            <div className="section-header">
              <div className="group-title"><b>Session setup</b></div>
              <button type="button" className="ghost clear-section-btn" onClick={clearSessionInfo}>Clear</button>
            </div>
            <ChoiceGroup label="Session duration" options={['20 min', '30 min', '45 min', '60 min']} value={data.duration} onChange={(value) => setField('duration', value)} />
            <div className="group-title"><b>Camera guidance</b><small>Optional</small></div>
            <button type="button" className="ghost calibration-skip" onClick={()=>skipped.includes('camera') ? restore('camera') : skip('camera', { placementConfirmed: false })}>{skipped.includes('camera') ? 'Show camera guidance' : 'Skip camera guidance'}</button>
            {!skipped.includes('camera') && <div className="placement-card">
              <span className="phone-icon"><Icon name="smartphone" size={18} /></span>
              <div><b>Camera preview setup</b><p>For a full-body preview, prop your phone at waist height, 2.5–3.0 m away. Live form analysis is unavailable.</p></div>
              <label className="placement-check"><input type="checkbox" checked={data.placementConfirmed} onChange={(event) => setField('placementConfirmed', event.target.checked)} />I understand this camera setup guidance</label>
            </div>}
          </>}

          {step === 4 && <>
            <div className="section-header">
              <div className="group-title"><b>Health & safety</b></div>
              <button type="button" className="ghost clear-section-btn" onClick={clearHealthInfo}>Clear</button>
            </div>
            <button type="button" className="ghost calibration-skip" onClick={()=>skipped.includes('health') ? restore('health') : skip('health', { conditions: [], healthNotes: '' })}>{skipped.includes('health') ? 'Add health notes' : 'Skip health notes'}</button>
            {!skipped.includes('health') && <><div className="choice-group condition-list">
              <div className="group-title"><b>Existing conditions</b><small>Optional</small></div>
              {conditionOptions.map((condition) => <label key={condition}><input type="checkbox" checked={data.conditions.includes(condition)} onChange={() => toggleCondition(condition)} />{condition}</label>)}
            </div>
            <div className="choice-group notes-group">
              <div className="group-title"><b>Additional information</b><small>Optional</small></div>
              <textarea value={data.healthNotes} onChange={(event) => setField('healthNotes', event.target.value)} maxLength={500} placeholder="Health notes you want to save with your profile" />
            </div>
            </>}
            <div className="choice-group emergency">
              <div className="group-title"><b>Emergency contact</b><small className="required">Required</small></div>
              <div className="safety-note"><span><Icon name="shield" size={16} /></span><p>Emergency contact information is saved with your profile. Alerts depend on device permissions and the configured delivery service.</p></div>
              <label className="field"><span>Name</span><div className="input-wrap"><input value={data.contactName} onChange={(event) => setField('contactName', event.target.value)} autoComplete="name" maxLength={100} /></div></label>
              <label className="field"><span>Mobile number</span><div className="input-wrap"><input type="tel" value={data.contactPhone} onChange={(event) => setField('contactPhone', formatPhoneNumber(event.target.value))} autoComplete="tel" placeholder="0999 999 9999" maxLength={13} /></div></label>
            </div>
          </>}
          {(error || submitError) && <p className="error" role="alert">{error || submitError}</p>}
        </div>
        </div>

        <footer className="wizard-footer calibration-footer">
          <button className="primary continue-btn" type="submit">
            {saving ? 'Saving profile…' : continueLabels[step - 1]} <Icon name={step === 4 ? 'check' : 'arrow'} size={16} />
          </button>
        </footer>
        </fieldset>
      </form>
    </section>
  );
}

function heightInMeters(height: string, inches: string, unit: CalibrationData['heightUnit']) {
  if (unit === 'cm') return Number(height) / 100;
  return (Number(height) * 12 + Number(inches || 0)) * 0.0254;
}

function NumberField({ label, value, suffix, min, max, step = '1', onChange }: {
  label: string;
  value: string;
  suffix: string;
  min: number;
  max: number;
  step?: string;
  onChange: (value: string) => void;
}) {
  return <label className="field"><span>{label}</span><div className="input-wrap"><input type="number" inputMode="decimal" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} aria-label={label} /><small>{suffix}</small></div></label>;
}

function UnitNumberField({ label, value, unit, units, min, max, step = '1', onChange, onUnitChange }: {
  label: string;
  value: string;
  unit: string;
  units: string[];
  min: number;
  max: number;
  step?: string;
  onChange: (value: string) => void;
  onUnitChange: (unit: string) => void;
}) {
  return <label className="field"><span>{label}</span><div className="input-wrap"><input type="number" inputMode="decimal" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} aria-label={label} /><select className="unit-suffix-select" aria-label={`${label} unit`} value={unit} onChange={(event) => onUnitChange(event.target.value)}>{units.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></label>;
}

function ChoiceGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="choice-group"><b>{label}</b><div className="chips">{options.map((option) => <button type="button" key={option} className={`chip ${value === option ? 'active' : ''}`} aria-pressed={value === option} onClick={() => onChange(option)}>{option}</button>)}</div></div>;
}

function activityDescription(activity: string) {
  if (activity === 'Sedentary') return 'Little or no regular exercise.';
  if (activity === 'Light') return '1–2 workouts a week with light movement.';
  if (activity === 'Active') return '5–6 workouts a week with regular movement.';
  if (activity === 'Athlete') return 'Frequent, high-intensity training.';
  return '3–4 workouts a week at a steady effort.';
}
