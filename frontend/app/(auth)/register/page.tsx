'use client';

import { useEffect, useRef, useState } from 'react';
import AuthForm from '../../../sections/Auth/AuthForm';
import CalibrationFlow from '../../../sections/Auth/CalibrationFlow';
import AuthOutcomeModal from '../../../sections/Auth/AuthOutcomeModal';
import { register, getCurrentUser } from '../../../lib/auth';
import { calibrationDraftKey, clearCalibrationDraft } from '../../../lib/calibrationDraft';
import { ApiRequestError, api } from '../../../lib/api';
import type { Profile } from '../../../sections/Home/types';
import { navigate } from '../../../lib/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [calibrationError, setCalibrationError] = useState('');
  const [authDialog, setAuthDialog] = useState<'email-registered' | 'account-created' | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const registeredAccount = useRef<{ scope: string | null; sessionKey: number | undefined } | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const recover = async () => {
    setCheckingAccount(true); setRecoveryFailed(false);
    const user = getCurrentUser();
    if (!user?.token) { setCheckingAccount(false); return; }
    const owner = calibrationDraftKey();
    const sameAccount = () => owner === calibrationDraftKey() && user.sessionKey === getCurrentUser()?.sessionKey;
    try {
      const profile = await api.getProfile(true);
      if (!sameAccount()) { setRecoveryFailed(true); return; }
      if (profile?.name) { clearCalibrationDraft(); navigate('/home'); return; }
      setName(user.name); setEmail(user.email); setCalibrating(true);
    } catch (err) {
      if (!sameAccount()) { setRecoveryFailed(true); return; }
      if (err instanceof ApiRequestError && err.statusCode === 404) { setName(user.name); setEmail(user.email); setCalibrating(true); }
      else setRecoveryFailed(true);
    } finally { setCheckingAccount(false); }
  };
  useEffect(() => { void recover(); }, []);

  const handleContinue = async (pass: string) => {
    if (!name.trim() || !email.trim() || !consent) {
      setError('Add your name and email, then agree to continue.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      emailInputRef.current?.focus();
      return;
    }
    if (pass.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setCreatingAccount(true);
    try {
      await register(name, normalizedEmail, pass);
      registeredAccount.current = { scope: calibrationDraftKey(), sessionKey: getCurrentUser()?.sessionKey };
      setAuthDialog('account-created');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      if ((err instanceof ApiRequestError && err.statusCode === 409) || /email already registered/i.test(message)) {
        setAuthDialog('email-registered');
      } else {
        setError(message);
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const finishCalibration = async (profile: Profile) => {
    setCalibrationError('');
    const owner = calibrationDraftKey(), sessionKey = getCurrentUser()?.sessionKey;
    const sameAccount = () => Boolean(owner && owner === calibrationDraftKey() && sessionKey === getCurrentUser()?.sessionKey);
    try {
      if (!sameAccount()) throw new Error('Your account or connection changed. Sign in again to continue setup.');
      // Prepare profile data for backend - remove fields that aren't in the DTO
      const profileData = {
        name: profile.name,
        age: profile.age,
        height: profile.height,
        heightInches: profile.heightInches || undefined,
        heightUnit: profile.heightUnit,
        weight: profile.weight,
        weightUnit: profile.weightUnit,
        gender: profile.gender,
        chest: profile.chest || undefined,
        waist: profile.waist || undefined,
        arms: profile.arms || undefined,
        chestUnit: profile.chestUnit || 'cm',
        waistUnit: profile.waistUnit || 'cm',
        armsUnit: profile.armsUnit || 'cm',
        activity: profile.activity,
        goal: profile.goal,
        targetWeight: profile.targetWeight || undefined,
        targetDate: profile.targetDate || undefined,
        seriousness: profile.seriousness,
        equipment: profile.equipment,
        days: profile.days,
        duration: profile.duration,
        conditions: profile.conditions,
        healthNotes: profile.healthNotes || undefined,
        contactName: profile.contactName,
        contactPhone: profile.contactPhone,
      };

      // Create profile in database (userId comes from JWT token in backend)
      let savedProfile;
      try { savedProfile = await api.createProfile(profileData); }
      catch (err) {
        if (!sameAccount()) throw new Error('Your account or connection changed. Sign in again to check your saved profile.');
        // A lost response may follow a committed create; never create a second profile.
        const existing = await api.getProfile(true).catch(() => null);
        if (!existing?.name) throw err;
        savedProfile = existing;
      }
      if (!sameAccount()) throw new Error('Your account or connection changed. Sign in again to check your saved profile.');

      // Also save to localStorage for now
      try { localStorage.setItem('physiquequest-profile', JSON.stringify({ ...profile, ...savedProfile })); } catch { /* Server profile is saved. */ }
      clearCalibrationDraft();

      navigate('/home');
    } catch (err) {
      setCalibrationError(err instanceof Error ? err.message : 'Could not save your profile. Please try again.');
    }
  };

  if (checkingAccount || recoveryFailed) return <main className="scene"><div className="app-shell"><section className="wizard"><h1>Continue setup</h1>{checkingAccount ? <p role="status">Checking your saved profile…</p> : <><p role="alert">Could not check your profile. Your device draft is unchanged.</p><button type="button" className="primary" onClick={()=>void recover()}>Retry setup recovery</button><a href="/login">Sign in again</a></>}</section></div></main>;

  if (calibrating) {
    return (
      <main className="scene">
        <div className="app-shell">
          <CalibrationFlow
            name={name}
            email={email}
            onComplete={finishCalibration}
            submitError={calibrationError}
          />
        </div>
      </main>
    );
  }

  return <>
    <main className="scene">
      <div className="app-shell">
        <AuthForm
          mode="register"
          onModeChange={(mode) => {
            if (mode === 'login') navigate('/login');
          }}
          name={name}
          email={email}
          onNameChange={setName}
          onEmailChange={setEmail}
          onContinue={handleContinue}
          error={error}
          onErrorChange={setError}
          consent={consent}
          onConsentChange={setConsent}
          onForgotPassword={() => {}}
          busy={creatingAccount}
          emailInputRef={emailInputRef}
        />
      </div>
    </main>
    {authDialog === 'email-registered' && <AuthOutcomeModal
      kind="email-registered"
      onClose={() => setAuthDialog(null)}
      email={email}
      onPrimary={() => navigate('/login')}
      onSecondary={() => {
        setAuthDialog(null);
        setEmail('');
        window.requestAnimationFrame(() => emailInputRef.current?.focus());
      }}
    />}
    {authDialog === 'account-created' && <AuthOutcomeModal
      kind="account-created"
      name={name}
      onPrimary={() => {
        setAuthDialog(null); setCalibrationError('');
        if (!registeredAccount.current?.scope || registeredAccount.current.scope !== calibrationDraftKey() || registeredAccount.current.sessionKey !== getCurrentUser()?.sessionKey) { void recover(); return; }
        setCalibrating(true);
      }}
    />}
  </>;
}
