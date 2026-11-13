'use client';

import { useRef, useState, type FormEvent } from 'react';
import PasswordStrengthChecker, { validatePassword } from '../../components/PasswordStrengthChecker';

type Props = {
  email: string;
  error: string;
  busy?: boolean;
  onErrorChange: (value: string) => void;
  onContinue: (password: string) => void | Promise<void>;
  onCancel: () => void;
};

export default function GoogleRegistrationPassword({ email, error, busy = false, onErrorChange, onContinue, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const working = busy || pending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (working || submitting.current) return;
    if (!validatePassword(password)) {
      onErrorChange('Please meet all password requirements.');
      return;
    }
    if (password !== confirmPassword) {
      onErrorChange('Your passwords do not match.');
      return;
    }
    if (!consent) {
      onErrorChange('Agree to the terms and privacy policy to continue.');
      return;
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
    <form className="auth-screen screen-enter" onSubmit={event => void submit(event)} aria-busy={working}>
      <div className="auth-body">
        <div className="auth-heading">
          <h2>Create your account password</h2>
          <p>Set a password for <strong>{email}</strong>. Next, verify your email with a one-time code, then finish your profile.</p>
        </div>
        <label className="field">
          <span>Password</span>
          <div className="input-wrap">
            <input type="password" autoComplete="new-password" required disabled={working} value={password} onChange={event => setPassword(event.target.value)} />
          </div>
        </label>
        <PasswordStrengthChecker password={password} />
        <label className="field">
          <span>Confirm password</span>
          <div className="input-wrap">
            <input type="password" autoComplete="new-password" required disabled={working} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
          </div>
        </label>
        <label className="consent">
          <input type="checkbox" required disabled={working} checked={consent} onChange={event => setConsent(event.target.checked)} />
          <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">terms</a>, <a href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>, and <a href="/camera-consent" target="_blank" rel="noopener noreferrer">camera-based health data processing</a>. These documents are drafts pending team review.</span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="auth-footer">
        <button type="submit" className="primary" disabled={working}>{working ? 'Sending verification code…' : 'Continue to email verification'}</button>
        <button type="button" className="secondary google-auth-cancel" disabled={working} onClick={onCancel}>Cancel Google registration</button>
      </div>
    </form>
  );
}
