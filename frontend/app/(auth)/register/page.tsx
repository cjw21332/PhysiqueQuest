'use client';

import { useRef, useState } from 'react';
import AuthForm from '../../../sections/Auth/AuthForm';
import CalibrationFlow from '../../../sections/Auth/CalibrationFlow';
import AuthOutcomeModal from '../../../sections/Auth/AuthOutcomeModal';
import { register } from '../../../lib/auth';
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
    try {
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
      await api.createProfile(profileData);

      // Also save to localStorage for now
      localStorage.setItem('physiquequest-profile', JSON.stringify(profile));

      navigate('/home');
    } catch (err) {
      setCalibrationError(err instanceof Error ? err.message : 'Could not save your profile. Please try again.');
    }
  };

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
      onPrimary={() => { setAuthDialog(null); setCalibrationError(''); setCalibrating(true); }}
    />}
  </>;
}
