'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../../../sections/Auth/AuthForm';
import ForgotPasswordFlow from '../../../sections/Forgot Password/ForgotPasswordFlow';
import { login } from '../../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [notice, setNotice] = useState('');

  const handleContinue = async () => {
    if (!email.trim()) {
      setError('Enter your email address to continue.');
      return;
    }

    try {
      await login(email, 'password'); // In production, use real password
      router.push('/home');
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  const handleForgotPasswordSuccess = () => {
    setShowForgotPassword(false);
    setNotice('Password reset successful! You can now log in with your new password.');
    setTimeout(() => setNotice(''), 3000);
  };

  return (
    <>
      <>
          <AuthForm
            mode="login"
            onModeChange={(mode) => {
              if (mode === 'register') router.push('/register');
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
            onForgotPassword={() => setShowForgotPassword(true)}
          />
          {notice && (
            <div className="toast" role="status">
              {notice}
              <button onClick={() => setNotice('')} aria-label="Dismiss">
                Ã—
              </button>
            </div>
          )}
        </>
      {showForgotPassword && (
        <ForgotPasswordFlow
          onClose={() => setShowForgotPassword(false)}
          onSuccess={handleForgotPasswordSuccess}
        />
      )}
    </>
  );
}


