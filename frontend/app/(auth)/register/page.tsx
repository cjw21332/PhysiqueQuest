'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../../../sections/Auth/AuthForm';
import { login } from '../../../lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);

  const handleContinue = async () => {
    if (!name.trim() || !email.trim() || !consent) {
      setError('Add your name and email, then agree to continue.');
      return;
    }

    try {
      await login(email, 'password'); // In production, use real password
      // Save profile data
      localStorage.setItem('physiquequest-profile', JSON.stringify({ name, email }));
      router.push('/home');
    } catch (err) {
      setError('Registration failed. Please try again.');
    }
  };

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
