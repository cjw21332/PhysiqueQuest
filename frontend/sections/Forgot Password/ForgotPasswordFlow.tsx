'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { api } from '../../lib/api';

type Step = 'reset' | 'verify' | 'password' | 'success';
type Props = { onClose: () => void; onSuccess: () => void };
const OTP_LENGTH = 6;
const RESEND_DELAY = 60;

export default function ForgotPasswordFlow({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('reset');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step !== 'verify' || resendSeconds === 0) return;
    const timer = window.setTimeout(() => setResendSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [step, resendSeconds]);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.requestPasswordReset(email.trim());
      if (response.delivery === 'unavailable' && !response.code) {
        setError('Password reset email is unavailable. Please contact support or try again later.');
        return;
      }
      setCode(response.delivery === 'unavailable' && response.code ? response.code : '');
      setResendSeconds(RESEND_DELAY);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a verification code.');
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    setError('');
    try {
      const response = await api.requestPasswordReset(email.trim());
      if (response.delivery === 'unavailable' && !response.code) {
        setError('Password reset email is unavailable. Please contact support or try again later.');
        return;
      }
      setCode(response.delivery === 'unavailable' && response.code ? response.code : '');
      setResendSeconds(RESEND_DELAY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the verification code.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Enter all 6 digits of your verification code.');
      return;
    }
    setBusy(true);
    try {
      await api.verifyPasswordResetCode(code);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That verification code is invalid or expired.');
    } finally {
      setBusy(false);
    }
  };

  const updateCodeAt = (index: number, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    if (digits.length > 1) {
      const pasted = digits.slice(0, OTP_LENGTH);
      setCode(pasted);
      codeInputs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
      return;
    }
    const next = code.padEnd(OTP_LENGTH, ' ').split('');
    next[index] = digits || ' ';
    setCode(next.join('').trimEnd());
    if (digits && index < OTP_LENGTH - 1) codeInputs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      codeInputs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      codeInputs.current[index + 1]?.focus();
    } else if (event.key === 'Backspace' && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  };

  const pasteCode = (event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setCode(pasted);
    codeInputs.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.confirmPasswordReset({ code: code.trim(), password });
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password.');
    } finally {
      setBusy(false);
    }
  };

  const formatCountdown = `${String(Math.floor(resendSeconds / 60)).padStart(2, '0')}:${String(resendSeconds % 60).padStart(2, '0')}`;

  return <div className="forgot-password-overlay">
    {step === 'verify' && <div className="forgot-password-modal forgot-password-modal-background" aria-hidden="true" inert>
      <div className="modal-header"><h3>Reset your password</h3><span className="close-btn">×</span></div>
      <div className="modal-body">
        <p className="modal-description">Enter the email address you signed up with and we’ll send you a verification code to reset your password.</p>
        <label className="forgot-field"><span>Email address</span><input type="email" value={email} readOnly /></label>
      </div>
      <div className="modal-footer"><button className="btn-primary" disabled>Send OTP Verification</button></div>
    </div>}
    <div className={`forgot-password-modal${step === 'verify' ? ' forgot-password-modal-otp' : ''}`}>
    {step === 'reset' && <>
      <div className="modal-header"><h3>Reset your password</h3><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div>
      <form onSubmit={event => void requestCode(event)}>
        <div className="modal-body">
          <p className="modal-description">Enter the email address you signed up with and we’ll send you a verification code to reset your password.</p>
          <label className="forgot-field"><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" /></label>
          {error && <p className="error-hint" role="alert">{error}</p>}
        </div>
        <div className="modal-footer"><button className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send OTP Verification'}</button></div>
      </form>
    </>}

    {step === 'verify' && <>
      <div className="modal-header"><h3>Verification code</h3><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div>
      <form onSubmit={event => void verifyCode(event)}>
        <div className="modal-body">
          <p className="modal-description">We have sent a verification code to <strong>{email}</strong></p>
          <div className="forgot-field">
            <span className="otp-label">6-digit code</span>
            <div className="otp-digit-inputs" role="group" aria-label="6-digit verification code" onPaste={pasteCode}>
              {Array.from({ length: OTP_LENGTH }, (_, index) => <input
                key={index}
                ref={element => { codeInputs.current[index] = element; }}
                className="otp-digit"
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                pattern="[0-9]"
                maxLength={OTP_LENGTH}
                value={code[index] && code[index] !== ' ' ? code[index] : ''}
                onChange={event => updateCodeAt(index, event.target.value)}
                onKeyDown={event => handleCodeKeyDown(index, event)}
              />)}
            </div>
          </div>
          {error && <p className="error-hint" role="alert">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-primary" disabled={busy}>{busy ? 'Verifying…' : 'Confirm'}</button>
          <button type="button" className="btn-link resend-code-button" onClick={() => void resendCode()} disabled={busy || resendSeconds > 0}>
            {resendSeconds > 0 ? `Resend Code in ${formatCountdown}` : 'Resend Code'}
          </button>
        </div>
      </form>
    </>}

    {step === 'password' && <>
      <div className="modal-header"><h3>Create new password</h3><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div>
      <form onSubmit={event => void confirm(event)}>
        <div className="modal-body">
          <p className="modal-description">Your identity is verified. Please provide a strong new password.</p>
          <label className="forgot-field"><span>New Password</span><div className="password-input-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={15} value={password} onChange={event => setPassword(event.target.value)} /><button type="button" className="eye-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showPassword}><EyeIcon visible={showPassword} /></button></div></label>
          <label className="forgot-field"><span>Confirm New Password</span><div className="password-input-wrap"><input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={15} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /><button type="button" className="eye-toggle" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPassword}><EyeIcon visible={showConfirmPassword} /></button></div></label>
          {error && <p className="error-hint" role="alert">{error}</p>}
        </div>
        <div className="modal-footer"><button className="btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update New Password'}</button></div>
      </form>
    </>}

    {step === 'success' && <>
      <div className="success-modal-content"><div className="success-icon">✓</div><h3 className="success-title">Password updated</h3><p className="success-description">Your password was changed successfully. Sign in with your new password.</p></div>
      <div className="modal-footer"><button className="btn-primary" onClick={() => { onSuccess(); onClose(); }}>Return to sign in</button></div>
    </>}
  </div></div>;
}

function EyeIcon({ visible }: { visible: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.7" />
    {visible && <path d="m4 4 16 16" />}
  </svg>;
}
