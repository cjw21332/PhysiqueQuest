'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthForm from '../sections/Auth/AuthForm';
import HomeSection from '../sections/Home/HomeSection';
import ThemeToggle, { type Theme } from '../sections/Home/ThemeToggle';

type Profile = { name: string; email: string; age: string; height: string; heightUnit: 'cm' | 'ftin'; weight: string; weightUnit: 'kg' | 'lbs'; gender: string; chest: string; waist: string; arms: string; activity: string; goal: string; targetWeight: string; targetDate: string; commitment: string; equipment: string[]; days: string[]; duration: string; conditions: string[]; notes: string; contactName: string; contactPhone: string };
const emptyProfile: Profile = { name: '', email: '', age: '', height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', gender: 'Male', chest: '', waist: '', arms: '', activity: 'Moderate', goal: 'Build muscle', targetWeight: '', targetDate: '', commitment: 'Consistent', equipment: ['Dumbbells'], days: ['M-0', 'W-2', 'F-4', 'S-5'], duration: '45 min', conditions: [], notes: '', contactName: '', contactPhone: '' };
const goals = [{ name: 'Weight loss', detail: 'Calorie deficit + conditioning', icon: 'weight-loss' }, { name: 'Build muscle', detail: 'Hypertrophy split, higher protein', icon: 'dumbbell' }, { name: 'Strength', detail: 'Low reps, progressive overload', icon: 'arm' }, { name: 'Endurance', detail: 'Circuit and interval focus', icon: 'pulse' }, { name: 'General fitness', detail: 'Balanced weekly plan', icon: 'heart-pulse' }];
const equipmentOptions = ['Bodyweight only', 'Dumbbells', 'Resistance bands', 'Full gym'];
const conditionsOptions = ['Knee injury', 'Lower back pain', 'Shoulder impingement', 'Hypertension', 'Asthma', 'None of these'];
const dayOptions = [{ label: 'M', key: 'M-0' }, { label: 'T', key: 'T-1' }, { label: 'W', key: 'W-2' }, { label: 'Th', key: 'T-3' }, { label: 'F', key: 'F-4' }, { label: 'S', key: 'S-5' }, { label: 'S', key: 'S-6' }];

function EyeIcon({ visible }: { visible: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{visible ? <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5.5 0 9 7 9 7a15.6 15.6 0 01-3.1 3.8M6.2 6.2C4.1 7.5 3 12 3 12s3.5 7 9 7a9 9 0 003-.5"/></> : <><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/></>}</svg>;
}

function GoalIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    'weight-loss': <><path d="M5 5v14h14"/><path d="m8 9 3 3 2-2 4 3"/><path d="M14 13h3v-3"/></>,
    dumbbell: <><path d="M6.5 8v8M4 9.5v5M17.5 8v8M20 9.5v5M6.5 12h11"/><path d="M9 9.5l3-3 3 3M9 14.5l3 3 3-3"/></>,
    arm: <><path d="M7 13V8a1.5 1.5 0 013 0v3l2-2a1.5 1.5 0 012.2 2l-1.4 2.1A4 4 0 019.5 18H8a3 3 0 01-3-3v-1a2 2 0 012-2z"/><path d="M10 14h4"/></>,
    pulse: <><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21"/></>,
    'heart-pulse': <><path d="M20.8 8.8c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.8 4.8 0 0112 6a4.8 4.8 0 018.8 2.8z"/><path d="M6.8 11h3l1.3-2.4 2.1 5 1.3-2.6h2.7"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export default function Home() {
  const [screen, setScreen] = useState<'launch' | 'auth' | 'wizard' | 'plan' | 'home'>('launch');
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => { try { const saved = localStorage.getItem('physiquequest-profile'); if (saved) setProfile({ ...emptyProfile, ...JSON.parse(saved) }); } catch { /* A fresh profile is used if saved browser data is unavailable. */ } setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem('physiquequest-profile', JSON.stringify(profile)); }, [profile, ready]);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('physiquequest-theme'); } catch { /* Fall back to the system preference below. */ }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved === 'light' || saved === 'dark' ? saved : prefersDark ? 'dark' : 'light');
  }, []);
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('physiquequest-theme', theme); } catch { /* The theme still applies for this session. */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070a0e' : '#f3f6f2');
  }, [theme]);
  const bmi = useMemo(() => {
    const heightCm = Number(profile.height);
    const enteredWeight = Number(profile.weight);
    if (!Number.isFinite(heightCm) || !Number.isFinite(enteredWeight) || heightCm <= 0 || enteredWeight <= 0) return null;
    const heightMeters = heightCm / 100;
    const weightKg = profile.weightUnit === 'lbs' ? enteredWeight * 0.45359237 : enteredWeight;
    const value = weightKg / (heightMeters * heightMeters);
    return Number.isFinite(value) ? value.toFixed(1) : null;
  }, [profile.height, profile.weight, profile.weightUnit]);
  const update = (key: keyof Profile, value: string) => setProfile(p => ({ ...p, [key]: value }));
  const toggleList = (key: 'equipment' | 'days' | 'conditions', value: string) => setProfile(p => {
    const list = p[key];
    if (key === 'conditions' && value === 'None of these') return { ...p, conditions: list.includes(value) ? [] : [value] };
    const next = list.includes(value) ? list.filter(item => item !== value) : [...list.filter(item => !(key === 'conditions' && item === 'None of these')), value];
    return { ...p, [key]: next };
  });
  const begin = () => { setScreen('auth'); setAuthMode('register'); setAuthError(''); };
  const continueAuth = () => {
    if (authMode === 'register' && (!profile.name.trim() || !profile.email.trim() || !consent)) { setAuthError('Add your name and email, then agree to continue.'); return; }
    if (!profile.email.trim()) { setAuthError('Enter your email address to continue.'); return; }
    setAuthError('');
    if (authMode === 'login') { setScreen('home'); return; }
    setScreen('wizard'); setStep(1);
  };
  const next = () => {
    if (step === 1 && (!Number(profile.age) || Number(profile.age) <= 0 || !bmi)) { setNotice('Enter a valid age, height and weight to continue.'); return; }
    if (step === 4 && (!profile.contactName.trim() || !profile.contactPhone.trim())) { setNotice('Add an emergency contact name and mobile number to finish.'); return; }
    setNotice(''); if (step < 4) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); } else setScreen('home');
  };
  const input = (label: string, key: keyof Profile, unit = '', type = 'text', placeholder = '') => <label className="field"><span>{label}</span><div className="input-wrap"><input type={type} placeholder={placeholder} value={profile[key] as string} onChange={e => update(key, e.target.value)} inputMode={type === 'number' ? 'decimal' : undefined} /><small>{unit}</small></div></label>;
  const displayWeight = (value: string) => value;
  const switchWeightUnit = (unit: 'kg' | 'lbs') => setProfile(p => {
    if (p.weightUnit === unit) return p;
    const factor = unit === 'lbs' ? 2.20462262 : 1 / 2.20462262;
    const convert = (value: string) => value === '' ? '' : String(Number((Number(value) * factor).toFixed(1)));
    return { ...p, weightUnit: unit, weight: convert(p.weight), targetWeight: convert(p.targetWeight) };
  });
  const heightTotalInches = Number(profile.height) / 2.54;
  const heightFeet = profile.height ? String(Math.floor(heightTotalInches / 12)) : '';
  const heightInches = profile.height ? String(Number((heightTotalInches % 12).toFixed(1))) : '';
  const changeHeightParts = (feet: string, inches: string) => { const totalInches = (Number(feet) || 0) * 12 + (Number(inches) || 0); update('height', totalInches ? String(Number((totalInches * 2.54).toFixed(2))) : ''); };
  const heightControl = <label className="field"><span>Height</span>{profile.heightUnit === 'cm' ? <div className="input-wrap"><input aria-label="Height" type="number" min="0" placeholder="e.g. 170" value={profile.height} onChange={e => update('height', e.target.value)} inputMode="decimal"/><select aria-label="Height unit" value="cm" onChange={e => setProfile(p => ({ ...p, heightUnit: e.target.value as Profile['heightUnit'] }))}><option value="cm">cm</option><option value="ftin">ft / in</option></select></div> : <div className="height-parts"><div className="input-wrap"><input aria-label="Height in feet" type="number" min="0" placeholder="5" value={heightFeet} onChange={e => changeHeightParts(e.target.value, heightInches)} inputMode="numeric"/><small>ft</small></div><div className="input-wrap"><input aria-label="Height in inches" type="number" min="0" max="11.9" step="0.1" placeholder="7" value={heightInches} onChange={e => changeHeightParts(heightFeet, e.target.value)} inputMode="decimal"/><select aria-label="Height unit" value="ftin" onChange={e => setProfile(p => ({ ...p, heightUnit: e.target.value as Profile['heightUnit'] }))}><option value="cm">cm</option><option value="ftin">ft / in</option></select></div></div>}</label>;
  const weightControl = (target = false) => { const key = target ? 'targetWeight' : 'weight'; return <label className="field"><span>{target ? 'Target weight' : 'Weight'}</span><div className="input-wrap"><input aria-label={`${target ? 'Target weight' : 'Weight'} in ${profile.weightUnit}`} type="number" min="0" placeholder={target ? '' : profile.weightUnit === 'kg' ? 'e.g. 70' : 'e.g. 154'} value={displayWeight(profile[key])} onChange={e => update(key, e.target.value)} inputMode="decimal"/><select aria-label="Weight unit" value={profile.weightUnit} onChange={e => switchWeightUnit(e.target.value as Profile['weightUnit'])}><option value="kg">kg</option><option value="lbs">lbs</option></select></div></label>; };

  return <main className="scene"><div className="app-shell">
    {theme && <ThemeToggle theme={theme} onToggle={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}/>}
    {screen === 'launch' && <section className="launch screen-enter"><div className="brand-mark">PQ</div><h1>PhysiqueQuest</h1><p className="subtitle">AI-assisted, gamified fitness<br className="desktop-break"/> coaching that watches your form.</p><div className="readiness"><div className="readiness-head"><b>Device readiness</b><span>2 of 3 ready</span></div><div className="ready-row"><b className="ready-icon">✓</b><p>Android 12 or higher<small>Android 14 detected</small></p></div><div className="ready-row"><b className="ready-icon">✓</b><p>High-speed Wi-Fi<small>Connected · 84 Mbps</small></p></div><div className="ready-row"><b className="camera-icon">◎</b><p>Camera permission<small>Needed for form tracking</small></p><button className="allow" onClick={() => setNotice('Camera access can be enabled when you start a camera-guided workout.')}>Allow</button></div></div><div className="launch-actions"><button className="primary" onClick={begin}>Get started</button><button className="secondary" onClick={() => { setAuthMode('login'); setAuthError(''); setScreen('auth'); }}>I already have an account</button></div></section>}

    {screen === 'auth' && <AuthForm mode={authMode} onModeChange={setAuthMode} name={profile.name} email={profile.email} onNameChange={value => update('name', value)} onEmailChange={value => update('email', value)} onContinue={continueAuth} error={authError} onErrorChange={setAuthError} consent={consent} onConsentChange={setConsent}/>}

    {screen === 'wizard' && <section className="wizard screen-enter"><div className="progress" aria-label={`Step ${step} of 4`}>{[1,2,3,4].map(n => <i key={n} className={step >= n ? 'filled' : ''}/>)}</div>
      <div className="wizard-heading"><small>Step {step} of 4 · Calibration</small><h2>{['Personal data', 'What are you training for?', 'Training preference', 'Health & safety'][step-1]}</h2><p>{['Used to size your plan and daily calorie targets.', 'Pick one primary goal. You can change it later.', 'Your plan is built around what you actually have.', 'Keeps unsafe exercises out of your plan.'][step-1]}</p></div>
      {step === 1 && <div className="step-content"><div className="field-grid">{input('Age', 'age', 'yrs', 'number')}{heightControl}</div>{weightControl()}<p className="bmi">BMI {bmi ?? '—'}{bmi ? <span> · calculated from your height and weight</span> : <span> · enter height and weight to calculate</span>}</p><div className="choice-group"><b>Gender</b><div className="chips">{['Male','Female','Other'].map(v=><button key={v} className={`chip ${profile.gender===v?'active':''}`} onClick={()=>update('gender',v)}>{v}</button>)}</div></div><div className="choice-group"><div className="group-title"><b>Body measurements</b><small>Optional</small></div><div className="measure-grid">{input('Chest','chest','cm','number')}{input('Waist','waist','cm','number')}{input('Arms','arms','cm','number')}</div></div><div className="choice-group"><b>Activity level</b><div className="chips wrap">{['Sedentary','Light','Moderate','Active','Athlete'].map(v=><button key={v} className={`chip ${profile.activity===v?'active':''}`} onClick={()=>update('activity',v)}>{v}</button>)}</div><p className="microcopy">{profile.activity==='Moderate'?'3–4 workouts a week at a steady effort.':`${profile.activity} activity level selected.`}</p></div></div>}
      {step === 2 && <div className="step-content"><div className="goal-list">{goals.map(g=><button key={g.name} className={`goal-card ${profile.goal===g.name?'chosen':''}`} onClick={()=>update('goal',g.name)}><span className="goal-icon"><GoalIcon name={g.icon}/></span><span className="goal-copy"><b>{g.name}</b><small>{g.detail}</small></span><span className={`radio ${profile.goal===g.name?'checked':''}`}/></button>)}</div><div className="field-grid target-grid">{weightControl(true)}{input('Target date','targetDate','','date')}</div><div className="choice-group"><b>How serious are you?</b><div className="chips">{['Casual','Consistent','Hardcore'].map(v=><button key={v} className={`chip ${profile.commitment===v?'active':''}`} onClick={()=>update('commitment',v)}>{v}</button>)}</div><p className="microcopy">A steady weekly plan with daily missions.</p></div></div>}
      {step === 3 && <div className="step-content"><div className="choice-group"><b>Equipment available</b><div className="equipment-grid">{equipmentOptions.map(v=><button key={v} className={`equipment ${profile.equipment.includes(v)?'on':''}`} onClick={()=>toggleList('equipment',v)}><span className="checkbox">{profile.equipment.includes(v)?'✓':''}</span>{v}</button>)}</div></div><div className="choice-group"><div className="group-title"><b>Training days</b><small>{profile.days.length} selected</small></div><div className="day-grid">{dayOptions.map(day=><button key={day.key} className={`day ${profile.days.includes(day.key)?'active':''}`} onClick={()=>toggleList('days',day.key)}>{day.label}</button>)}</div></div><div className="choice-group"><b>Session duration</b><div className="chips wrap">{['20 min','30 min','45 min','60 min'].map(v=><button key={v} className={`chip ${profile.duration===v?'active':''}`} onClick={()=>update('duration',v)}>{v}</button>)}</div></div><div className="placement-card"><span className="phone-icon">▯</span><div><b>Phone placement for form tracking</b><p>Prop your phone at waist height, 2.5–3.0 m away, so your full body stays in frame.</p></div><label className="placement-check"><input type="checkbox" defaultChecked/><span>I can place my phone 2.5–3.0 m away</span></label></div></div>}
      {step === 4 && <div className="step-content"><div className="choice-group"><b>Existing conditions</b><div className="condition-list">{conditionsOptions.map(v=><label key={v}><input type="checkbox" checked={profile.conditions.includes(v)} onChange={()=>toggleList('conditions',v)}/><span>{v}</span></label>)}</div></div><div className="choice-group notes-group"><div className="group-title"><b>Additional information</b><small>Optional</small></div><textarea placeholder="Recent surgery, medication, anything your coach should know…" value={profile.notes} onChange={e=>update('notes',e.target.value)}/></div><div className="choice-group emergency"><div className="group-title"><b>Emergency contact</b><small className="required">Required</small></div><div className="safety-note"><span>♧</span><p>If you stop moving during a session and don’t respond, we’ll alert this person with your location.</p></div>{input('Name','contactName','','text','')}{input('Mobile number','contactPhone','','tel','')}</div></div>}
      {notice && <p className="error notice" role="alert">{notice}</p>}<footer className="wizard-footer"><button className="primary" onClick={next}>{step===4?'Finish & build my plan':<>Next: {['','Goals','Training','Health info'][step]} <span className="arrow">→</span></>}</button>{step>1 && <button className="back" onClick={()=>{setStep(step-1);setNotice('');}}>Back</button>}</footer>
    </section>}

    {screen === 'home' && <HomeSection profile={profile}/>} 
    {screen === 'plan' && <section className="plan-screen screen-enter"><div className="plan-icon">✓</div><small className="eyebrow">YOUR QUEST STARTS NOW</small><h2>Your plan is ready, {profile.name.split(' ')[0] || 'athlete'}.</h2><p className="subtitle">A personal {profile.goal.toLowerCase()} plan, built around your goals and schedule.</p><div className="plan-summary"><div><small>YOUR GOAL</small><b>{profile.goal}</b></div><div><small>TRAINING DAYS</small><b>{profile.days.length} days · {profile.duration}</b></div><div><small>STARTING BMI</small><b>{bmi}</b></div></div><button className="primary" onClick={()=>setScreen('wizard')}>Edit my plan</button><button className="secondary" onClick={()=>{setProfile(emptyProfile);setScreen('launch');setNotice('');}}>Start over</button><p className="saved-note">Your profile is saved on this device.</p></section>}
    {screen === 'launch' && notice && <div className="toast" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss">×</button></div>}
    </div></main>;
}
