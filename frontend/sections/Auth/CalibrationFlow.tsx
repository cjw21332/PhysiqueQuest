'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../Home/icons';
import type { Profile } from '../Home/types';

type CalibrationData = {
  age: string;
  height: string;
  weight: string;
  gender: string;
  chest: string;
  waist: string;
  arms: string;
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
  age: '', height: '', weight: '', gender: 'Male', chest: '', waist: '', arms: '', activity: 'Moderate',
  goal: 'Build muscle', targetWeight: '', targetDate: '', seriousness: 'Consistent',
  equipment: ['Dumbbells'], days: ['M-0', 'W-2', 'F-4', 'S-5'], duration: '45 min', placementConfirmed: false,
  conditions: [], healthNotes: '', contactName: '', contactPhone: '',
};

const goalOptions = [
  { title: 'Weight loss', detail: 'Calorie deficit + conditioning', icon: 'trend' },
  { title: 'Build muscle', detail: 'Hypertrophy split, higher protein', icon: 'dumbbell' },
  { title: 'Strength', detail: 'Low reps, progressive overload', icon: 'health' },
  { title: 'Endurance', detail: 'Circuit and interval focus', icon: 'clock' },
  { title: 'General fitness', detail: 'Balanced weekly plan', icon: 'target' },
];
const equipmentOptions = ['Bodyweight only', 'Dumbbells', 'Resistance bands', 'Full gym'];
const dayOptions = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const activityOptions = ['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete'];
const conditionOptions = ['Knee injury', 'Lower back pain', 'Shoulder impingement', 'Hypertension', 'Asthma', 'None of these'];

export default function CalibrationFlow({ name, email, onComplete, onBackToRegister }: {
  name: string;
  email: string;
  onComplete: (profile: Profile) => void;
  onBackToRegister: () => void;
}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CalibrationData>(initialData);
  const [error, setError] = useState('');

  const bmi = useMemo(() => {
    const heightMeters = Number(data.height) / 100;
    const weight = Number(data.weight);
    return heightMeters > 0 && weight > 0 ? (weight / (heightMeters * heightMeters)).toFixed(1) : '';
  }, [data.height, data.weight]);

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
    const dayId = `${dayOptions[index]}-${index}`;
    setData((current) => ({
      ...current,
      days: current.days.includes(dayId) ? current.days.filter((day) => day !== dayId) : [...current.days, dayId],
    }));
  };

  function submitStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (step === 1) {
      const age = Number(data.age);
      const height = Number(data.height);
      const weight = Number(data.weight);
      if (!age || age < 13 || age > 100) { setError('Enter an age between 13 and 100.'); return; }
      if (!height || height < 80 || height > 250) { setError('Enter a height between 80 and 250 cm.'); return; }
      if (!weight || weight < 25 || weight > 350) { setError('Enter a weight between 25 and 350 kg.'); return; }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!data.goal) { setError('Choose a primary training goal.'); return; }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!data.equipment.length) { setError('Choose at least one available equipment option.'); return; }
      if (!data.days.length) { setError('Choose at least one training day.'); return; }
      if (!data.placementConfirmed) { setError('Confirm that you can place your phone at a safe distance.'); return; }
      setStep(4);
      return;
    }
    if (!data.contactName.trim() || !data.contactPhone.trim()) {
      setError('Add an emergency contact name and mobile number to continue.');
      return;
    }

    const days = data.days.map((value) => value.split('-')[0]);
    onComplete({
      name: name.trim(), email: email.trim(), age: data.age, gender: data.gender,
      height: data.height, weight: data.weight, weightUnit: 'kg',
      chest: data.chest, waist: data.waist, arms: data.arms, activity: data.activity,
      goal: data.goal, targetWeight: data.targetWeight, targetDate: data.targetDate,
      seriousness: data.seriousness, equipment: data.equipment, days,
      duration: data.duration, conditions: data.conditions, healthNotes: data.healthNotes.trim(),
      contactName: data.contactName.trim(), contactPhone: data.contactPhone.trim(),
    });
  }

  const stepTitles = ['Personal data', 'What are you training for?', 'Training preference', 'Health & safety'];
  const continueLabels = ['Next: Goals', 'Next: Training', 'Next: Health info', 'Finish & build my plan'];

  return (
    <section className="wizard calibration-wizard" aria-label={`Calibration step ${step} of 4`}>
      <div className="progress" role="img" aria-label={`Step ${step} of 4`}>
        {stepTitles.map((title, index) => <i key={title} className={index < step ? 'filled' : ''} />)}
      </div>
      <div className="wizard-heading">
        <small>Step {step} of 4 · Calibration</small>
        <h2>{stepTitles[step - 1]}</h2>
        <p>{step === 1 ? 'Used to size your plan and daily calorie targets.' : step === 2 ? 'Pick one primary goal. You can change it later.' : step === 3 ? 'Your plan is built around what you actually have.' : 'Keeps unsafe exercises out of your plan.'}</p>
      </div>

      <form className="calibration-form" onSubmit={submitStep}>
        <div className="step-content">
          {step === 1 && <>
            <div className="field-grid">
              <NumberField label="Age" value={data.age} suffix="yrs" min={13} max={100} onChange={(value) => setField('age', value)} />
              <NumberField label="Height" value={data.height} suffix="cm" min={80} max={250} onChange={(value) => setField('height', value)} />
            </div>
            <NumberField label="Weight" value={data.weight} suffix="kg" min={25} max={350} step="0.1" onChange={(value) => setField('weight', value)} />
            <p className="bmi">{bmi ? `BMI ${bmi}` : 'BMI calculated from your height and weight'}</p>
            <ChoiceGroup label="Gender" options={['Male', 'Female', 'Other']} value={data.gender} onChange={(value) => setField('gender', value)} />
            <div className="choice-group">
              <div className="group-title"><b>Body measurements</b><small>Optional</small></div>
              <div className="measure-grid">
                <NumberField label="Chest" value={data.chest} suffix="cm" min={1} max={250} onChange={(value) => setField('chest', value)} />
                <NumberField label="Waist" value={data.waist} suffix="cm" min={1} max={250} onChange={(value) => setField('waist', value)} />
                <NumberField label="Arms" value={data.arms} suffix="cm" min={1} max={150} onChange={(value) => setField('arms', value)} />
              </div>
            </div>
            <ChoiceGroup label="Activity level" options={activityOptions} value={data.activity} onChange={(value) => setField('activity', value)} />
            <p className="microcopy">{activityDescription(data.activity)}</p>
          </>}

          {step === 2 && <>
            <div className="goal-list">
              {goalOptions.map((option) => (
                <button type="button" key={option.title} className={`goal-card ${data.goal === option.title ? 'chosen' : ''}`} aria-pressed={data.goal === option.title} onClick={() => setField('goal', option.title)}>
                  <span className="goal-icon"><Icon name={option.icon} size={20} /></span>
                  <span className="goal-copy"><b>{option.title}</b><small>{option.detail}</small></span>
                  <span className={`radio ${data.goal === option.title ? 'checked' : ''}`} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="field-grid target-grid">
              <NumberField label="Target weight" value={data.targetWeight} suffix="kg" min={25} max={350} step="0.1" onChange={(value) => setField('targetWeight', value)} />
              <label className="field"><span>Target date</span><div className="input-wrap"><input type="date" value={data.targetDate} onChange={(event) => setField('targetDate', event.target.value)} aria-label="Target date" /></div></label>
            </div>
            <ChoiceGroup label="How serious are you?" options={['Casual', 'Consistent', 'Hardcore']} value={data.seriousness} onChange={(value) => setField('seriousness', value)} />
            <p className="microcopy">{data.seriousness === 'Casual' ? 'A flexible plan that fits your pace.' : data.seriousness === 'Hardcore' ? 'A challenging plan with focused weekly targets.' : 'A steady weekly plan with daily missions.'}</p>
          </>}

          {step === 3 && <>
            <div className="choice-group training-equipment">
              <div className="group-title"><b>Equipment available</b></div>
              <div className="equipment-grid">
                {equipmentOptions.map((option) => {
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
                  return <button type="button" key={`${day}-${index}`} className={`day ${selected ? 'active' : ''}`} aria-label={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]}${selected ? ', selected' : ''}`} aria-pressed={selected} onClick={() => toggleDay(index)}>{day}</button>;
                })}
              </div>
            </div>
            <ChoiceGroup label="Session duration" options={['20 min', '30 min', '45 min', '60 min']} value={data.duration} onChange={(value) => setField('duration', value)} />
            <div className="placement-card">
              <span className="phone-icon"><Icon name="phone" size={18} /></span>
              <div><b>Phone placement for form tracking</b><p>Prop your phone at waist height, 2.5–3.0 m away, so your full body stays in frame.</p></div>
              <label className="placement-check"><input type="checkbox" checked={data.placementConfirmed} onChange={(event) => setField('placementConfirmed', event.target.checked)} />I can place my phone 2.5–3.0 m away</label>
            </div>
          </>}

          {step === 4 && <>
            <div className="choice-group condition-list">
              <div className="group-title"><b>Existing conditions</b></div>
              {conditionOptions.map((condition) => <label key={condition}><input type="checkbox" checked={data.conditions.includes(condition)} onChange={() => toggleCondition(condition)} />{condition}</label>)}
            </div>
            <div className="choice-group notes-group">
              <div className="group-title"><b>Additional information</b><small>Optional</small></div>
              <textarea value={data.healthNotes} onChange={(event) => setField('healthNotes', event.target.value)} maxLength={500} placeholder="Recent surgery, medication, anything your coach should know" />
            </div>
            <div className="choice-group emergency">
              <div className="group-title"><b>Emergency contact</b><small className="required">Required</small></div>
              <div className="safety-note"><span><Icon name="shield" size={16} /></span><p>Emergency contact information is saved with your profile. Safety alerts are not connected in this prototype.</p></div>
              <label className="field"><span>Name</span><div className="input-wrap"><input value={data.contactName} onChange={(event) => setField('contactName', event.target.value)} autoComplete="name" maxLength={100} /></div></label>
              <label className="field"><span>Mobile number</span><div className="input-wrap"><input type="tel" value={data.contactPhone} onChange={(event) => setField('contactPhone', event.target.value)} autoComplete="tel" maxLength={30} /></div></label>
            </div>
          </>}
          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <footer className="wizard-footer calibration-footer">
          {step === 1
            ? <button type="button" className="calibration-back-link" onClick={onBackToRegister}>Back to account</button>
            : <button type="button" className="calibration-back-link" onClick={() => { setError(''); setStep((current) => current - 1); }}>Back</button>}
          <button className="primary" type="submit">{continueLabels[step - 1]} <Icon name={step === 4 ? 'check' : 'arrow'} size={16} /></button>
        </footer>
      </form>
    </section>
  );
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
