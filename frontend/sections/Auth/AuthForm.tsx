'use client';

import { useRef, useState, type Ref, type FormEvent } from 'react';
import PasswordStrengthChecker, { validatePassword } from '../../components/PasswordStrengthChecker';
import PolicyConsent from './PolicyConsent';

type Props = {
  mode: 'register' | 'login';
  onModeChange: (mode: 'register' | 'login') => void;
  name: string;
  email: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onContinue: (password: string) => void | Promise<void>;
  error: string;
  onErrorChange: (value: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  onForgotPassword: () => void;
  onGoogleAuth?: () => void | Promise<void>;
  busy?: boolean;
  emailInputRef?: Ref<HTMLInputElement>;
};

function EyeIcon({ visible }: { visible: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{visible ? <><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 002.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0112 5c5.5 0 9 7 9 7a15.6 15.6 0 01-3.1 3.8M6.2 6.2C4.1 7.5 3 12 3 12s3.5 7 9 7a9 9 0 003-.5"/></> : <><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/></>}</svg>;
}

export default function AuthForm({ mode, onModeChange, name, email, onNameChange, onEmailChange, onContinue, error, onErrorChange, consent, onConsentChange, onForgotPassword, onGoogleAuth, busy = false, emailInputRef }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const working = busy || pending || googlePending;
  const register = mode === 'register';

  const handleGoogleAuth = async () => {
    if (!onGoogleAuth || working) return;
    setGooglePending(true);
    onErrorChange('');
    try {
      await onGoogleAuth();
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : 'Google sign-in could not be completed. Please try again.');
    } finally {
      setGooglePending(false);
    }
  };

  const passwordField = (label: string, value: string, onChange: (value: string) => void, visible: boolean, toggle: () => void, confirm = false) => (
    <>
      <label className="field">
        <span>{label}</span>
        <div className="input-wrap">
          <input
            type={visible ? 'text' : 'password'}
            placeholder={confirm ? 'Re-enter password' : 'At least 8 characters'}
            value={value}
            onChange={e => onChange(e.target.value)}
            autoComplete={confirm ? 'new-password' : register ? 'new-password' : 'current-password'}
            required
            disabled={working}
          />
          <button
            type="button"
            className="eye"
            onClick={toggle}
            aria-label={visible ? `Hide ${confirm ? 'confirm password' : 'password'}` : `Show ${confirm ? 'confirm password' : 'password'}`}
            aria-pressed={visible}
          >
            <EyeIcon visible={visible}/>
          </button>
        </div>
      </label>
      {register && !confirm && <PasswordStrengthChecker password={value} />}
    </>
  );

  const handleContinue = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || submitting.current) return;
    if (register) {
      if (!validatePassword(password)) {
        onErrorChange('Please meet all password requirements.');
        return;
      }
      if (password !== confirmPassword) {
        onErrorChange('Your passwords do not match.');
        return;
      }
    } else {
      if (!password) {
        onErrorChange('Please enter your password.');
        return;
      }
    }
    submitting.current = true;
    setPending(true);
    onErrorChange('');
    try {
      await onContinue(password);
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : 'Could not continue. Please try again.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <form className={`auth-screen screen-enter ${register ? 'registration-screen' : ''}`} onSubmit={event => void handleContinue(event)} aria-busy={working}>
      <div className="auth-body">
        <div className="auth-heading">
          {register && <span className="registration-eyebrow">YOUR JOURNEY STARTS HERE</span>}
          <h2>{register ? 'Create your account' : 'Welcome back'}</h2>
          <p>{register ? 'A few details now. A plan built around you next.' : 'Log in to continue your fitness journey.'}</p>
        </div>
        <div className="segmented">
          <button type="button" disabled={working} aria-pressed={register} className={register ? 'selected' : ''} onClick={() => { onModeChange('register'); onErrorChange(''); }}>
            Register
          </button>
          <button type="button" disabled={working} aria-pressed={!register} className={!register ? 'selected' : ''} onClick={() => { onModeChange('login'); onErrorChange(''); }}>
            Log in
          </button>
        </div>
        {register && (
          <label className="field">
            <span>Full name</span>
            <div className="input-wrap">
              <input autoComplete="name" required disabled={working} placeholder="Juan Dela Cruz" value={name} onChange={e => onNameChange(e.target.value)}/>
            </div>
          </label>
        )}
        <label className="field">
          <span>Email address</span>
          <div className="input-wrap">
            <input ref={emailInputRef} type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" required disabled={working} placeholder="you@email.com" value={email} onChange={e => onEmailChange(e.target.value)}/>
          </div>
        </label>
        {passwordField('Password', password, setPassword, showPassword, () => setShowPassword(v => !v))}
        {!register && <button type="button" className="forgot-password-link" disabled={working} onClick={onForgotPassword}>Forgot Password?</button>}
        {register && (
          <>
            {passwordField('Confirm password', confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword(v => !v), true)}
            <PolicyConsent checked={consent} onChange={onConsentChange} disabled={working}/>
          </>
        )}
        {onGoogleAuth && (
          <div className="google-auth-action">
            <div className="google-auth-divider"><span>or</span></div>
            <button type="button" className="google-auth-button" disabled={working} onClick={() => void handleGoogleAuth()}>
              <svg className="google-auth-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44c-.29 1.46-1.12 2.7-2.36 3.53v2.94h3.81c2.23-2.05 3.6-5.07 3.6-8.71Z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.92l-3.81-2.94c-1.08.72-2.46 1.15-4.14 1.15-3.18 0-5.88-2.14-6.84-5.02H1.22v3.04A12 12 0 0 0 12 24Z"/>
                <path fill="#FBBC05" d="M5.16 14.27A7.2 7.2 0 0 1 4.79 12c0-.79.14-1.55.37-2.27V6.69H1.22A12 12 0 0 0 0 12c0 1.94.46 3.77 1.22 5.31l3.94-3.04Z"/>
                <path fill="#EA4335" d="M12 4.71c1.77 0 3.35.61 4.6 1.81l3.45-3.45C17.95 1.14 15.24 0 12 0A12 12 0 0 0 1.22 6.69l3.94 3.04C6.12 6.85 8.82 4.71 12 4.71Z"/>
              </svg>
              {googlePending ? 'Connecting to Google…' : `${register ? 'Register' : 'Log in'} with Google`}
            </button>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="auth-footer">
        <button type="submit" className="primary" disabled={working}>
          {working ? register ? 'Creating account…' : 'Logging in…' : register ? 'Create account' : 'Log in'}
        </button>
      </div>
    </form>
  );
}
