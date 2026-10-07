'use client';

import { useState } from 'react';
import AuthForm from '../../../sections/Auth/AuthForm';
import ForgotPasswordFlow from '../../../sections/Forgot Password/ForgotPasswordFlow';
import AuthOutcomeModal from '../../../sections/Auth/AuthOutcomeModal';
import { login } from '../../../lib/auth';
import { ApiRequestError } from '../../../lib/api';
import { navigate } from '../../../lib/navigation';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginDialog, setLoginDialog] = useState<{ locked: boolean } | null>(null);
  const [notice, setNotice] = useState('');

  const handleContinue = async (password: string) => {
    if (!email.trim()) {
      setError('Enter your email address to continue.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Enter your password to continue.');
      return;
    }

    try {
      await login(email, password);
      navigate('/home');
    } catch (err) {
      if (err instanceof ApiRequestError && (err.statusCode === 401 || err.statusCode === 429)) {
        setError('');
        setLoginDialog({ locked: err.statusCode === 429 });
      } else {
        setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
      }
    }
  };

  const handleForgotPasswordSuccess = () => {
    setShowForgotPassword(false);
    setNotice('Password reset successful! You can now log in with your new password.');
    setTimeout(() => setNotice(''), 3000);
  };

  return (
    <>
      <main className="scene">
        <div className="app-shell">
          <AuthForm
            mode="login"
            onModeChange={(mode) => {
              if (mode === 'register') navigate('/register');
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
                ×
              </button>
            </div>
          )}
        </div>
      </main>
      {showForgotPassword && (
        <ForgotPasswordFlow
          onClose={() => setShowForgotPassword(false)}
          onSuccess={handleForgotPasswordSuccess}
        />
      )}
      {loginDialog && <AuthOutcomeModal
        kind="login-failed"
        locked={loginDialog.locked}
        onPrimary={() => {
          if (loginDialog.locked) {
            setLoginDialog(null);
            setShowForgotPassword(true);
          } else {
            setLoginDialog(null);
          }
        }}
        onSecondary={() => { setLoginDialog(null); setShowForgotPassword(true); }}
      />}
    </>
  );
}
