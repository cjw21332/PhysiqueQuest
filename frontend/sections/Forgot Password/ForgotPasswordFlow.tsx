'use client';

import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';

type Step = 'reset' | 'confirm' | 'success';
type Props = { onClose: () => void; onSuccess: () => void };

export default function ForgotPasswordFlow({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('reset');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await api.requestPasswordReset(email.trim());
      if (response.delivery === 'unavailable') { setError('Password reset email delivery is not configured. Contact support or try again after email is set up.'); return; }
      setStep('confirm');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not request a password reset.'); }
    finally { setBusy(false); }
  };
  const confirm = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { await api.confirmPasswordReset({ token: token.trim(), password }); setStep('success'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update the password.'); }
    finally { setBusy(false); }
  };

  return <div className="forgot-password-overlay"><div className="forgot-password-modal">
    {step === 'reset' && <><div className="modal-header"><h3>Reset your password</h3><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div><form onSubmit={event => void request(event)}><div className="modal-body"><p className="modal-description">Enter your account email. If email delivery is configured, we’ll send a one-time reset token.</p><label className="forgot-field"><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com"/></label>{error && <p className="error-hint" role="alert">{error}</p>}</div><div className="modal-footer"><button className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Request reset token'}</button></div></form></>}
    {step === 'confirm' && <><div className="modal-header"><h3>Choose a new password</h3><button className="close-btn" onClick={onClose} aria-label="Close">×</button></div><form onSubmit={event => void confirm(event)}><div className="modal-body"><p className="modal-description">Paste the one-time token from your email. It expires after 30 minutes.</p><label className="forgot-field"><span>Reset token</span><input autoComplete="one-time-code" required minLength={40} value={token} onChange={event => setToken(event.target.value)} /></label><label className="forgot-field"><span>New password</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={15} value={password} onChange={event => setPassword(event.target.value)} /></label><label className="forgot-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={15} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>{error && <p className="error-hint" role="alert">{error}</p>}</div><div className="modal-footer"><button className="btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button><button type="button" className="btn-link" onClick={() => { setStep('reset'); setError(''); }}>Request another token</button></div></form></>}
    {step === 'success' && <><div className="success-modal-content"><div className="success-icon">✓</div><h3 className="success-title">Password updated</h3><p className="success-description">Your password was changed successfully. Sign in with your new password.</p></div><div className="modal-footer"><button className="btn-primary" onClick={() => { onSuccess(); onClose(); }}>Return to sign in</button></div></>}
  </div></div>;
}
