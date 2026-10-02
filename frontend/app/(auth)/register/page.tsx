'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../../../sections/Auth/AuthForm';
import CalibrationFlow from '../../../sections/Auth/CalibrationFlow';
import { register } from '../../../lib/auth';
import { api } from '../../../lib/api';
import type { Profile } from '../../../sections/Home/types';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [calibrating, setCalibrating] = useState(false);

  const handleContinue = (pass: string) => {
    if (!name.trim() || !email.trim() || !consent) {
      setError('Add your name and email, then agree to continue.');
      return;
    }
    if (pass.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setPassword(pass);
    setError('');
    setCalibrating(true);
  };

  const finishCalibration = async (profile: Profile) => {
    try {
      // Register user with backend ONLY after completing calibration
      const user = await register(name, email, password);

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
        // Backend uses single measurementUnit instead of separate units
        measurementUnit: profile.chestUnit || profile.waistUnit || profile.armsUnit || 'cm',
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

      router.push('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      setCalibrating(false);
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
