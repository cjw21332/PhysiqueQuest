'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../../../sections/Auth/AuthForm';
import CalibrationFlow from '../../../sections/Auth/CalibrationFlow';
import { login } from '../../../lib/auth';
import type { Profile } from '../../../sections/Home/types';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [calibrating, setCalibrating] = useState(false);

  const handleContinue = () => {
    if (!name.trim() || !email.trim() || !consent) {
      setError('Add your name and email, then agree to continue.');
      return;
    }
    setError('');
    setCalibrating(true);
  };

  const finishCalibration = async (profile: Profile) => {
    try {
      localStorage.setItem('physiquequest-profile', JSON.stringify(profile));
      await login(email, 'prototype-registration');
      router.push('/home');
    } catch {
      setError('We could not finish your local setup. Please try again.');
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
          />
        </div>
      </main>
    );
  }

  return (
    <main className="scene">
      <div className="app-shell">
        <AuthForm
          mode="register"
          onModeChange={(mode) => {
            if (mode === 'login') router.push('/login');
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
        />
      </div>
    </main>
  );
}
