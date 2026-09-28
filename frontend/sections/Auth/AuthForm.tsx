'use client';

import { useState } from 'react';

type Props = {
  mode: 'register' | 'login';
  onModeChange: (mode: 'register' | 'login') => void;
  name: string;
  email: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onContinue: () => void;
  error: string;
  onErrorChange: (value: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
};

function EyeIcon({ visible }: { visible: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{visible ? <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5.5 0 9 7 9 7a15.6 15.6 0 01-3.1 3.8M6.2 6.2C4.1 7.5 3 12 3 12s3.5 7 9 7a9 9 0 003-.5"/></> : <><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/></>}</svg>;
}

export default function AuthForm({ mode, onModeChange, name, email, onNameChange, onEmailChange, onContinue, error, onErrorChange, consent, onConsentChange }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const register = mode === 'register';

  const passwordField = (label: string, value: string, onChange: (value: string) => void, visible: boolean, toggle: () => void, confirm = false) => <label className="field"><span>{label}</span><div className="input-wrap"><input type={visible ? 'text' : 'password'} placeholder={confirm ? 'Re-enter password' : 'At least 8 characters'} value={value} onChange={e => onChange(e.target.value)} autoComplete={confirm ? 'new-password' : register ? 'new-password' : 'current-password'}/><button type="button" className="eye" onClick={toggle} aria-label={visible ? `Hide ${confirm ? 'confirm password' : 'password'}` : `Show ${confirm ? 'confirm password' : 'password'}`} aria-pressed={visible}><EyeIcon visible={visible}/></button></div></label>;

  return <section className="auth-screen screen-enter"><div className="auth-heading"><h2>{register ? 'Create your account' : 'Welcome back'}</h2><p>{register ? 'It takes about two minutes to set up your plan.' : 'Log in to continue your fitness journey.'}</p></div><div className="segmented"><button className={register ? 'selected' : ''} onClick={() => { onModeChange('register'); onErrorChange(''); }}>Register</button><button className={!register ? 'selected' : ''} onClick={() => { onModeChange('login'); onErrorChange(''); }}>Log in</button></div>
    {register && <label className="field"><span>Full name</span><div className="input-wrap"><input placeholder="Juan Dela Cruz" value={name} onChange={e => onNameChange(e.target.value)}/></div></label>}
    <label className="field"><span>Email address</span><div className="input-wrap"><input type="email" placeholder="you@email.com" value={email} onChange={e => onEmailChange(e.target.value)}/></div></label>
    {register && <small className="hint">Tip: try juan@email.com to see the error state</small>}
    {passwordField('Password', password, setPassword, showPassword, () => setShowPassword(v => !v))}
    {register && <>{passwordField('Confirm password', confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword(v => !v), true)}<label className="consent"><input type="checkbox" checked={consent} onChange={e => onConsentChange(e.target.checked)}/><span>I agree to the terms, privacy policy, and camera-based health data processing.</span></label></>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="auth-footer"><button className="primary" onClick={() => { if (register && (password.length < 8 || password !== confirmPassword)) { onErrorChange(password.length < 8 ? 'Use a password with at least 8 characters.' : 'Your passwords do not match.'); return; } onContinue(); }}>{register ? 'Create account' : 'Log in'}</button></div>
  </section>;
}
