'use client';

import { useState, useEffect, useRef } from 'react';

type Step = 'reset' | 'verification' | 'newPassword' | 'success';

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {visible ? (
        <>
          <path d="M3 3l18 18"/>
          <path d="M10.6 10.6a2 2 0 002.8 2.8"/>
          <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.5 0 9 7 9 7a15.6 15.6 0 01-3.1 3.8M6.2 6.2C4.1 7.5 3 12 3 12s3.5 7 9 7a9 9 0 003-.5"/>
        </>
      ) : (
        <>
          <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/>
          <circle cx="12" cy="12" r="3"/>
        </>
      )}
    </svg>
  );
}

export default function ForgotPasswordFlow({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('reset');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [showResendToast, setShowResendToast] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (showResendToast) {
      const timer = setTimeout(() => setShowResendToast(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showResendToast]);

  const handleSendOTP = () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setResendTimer(75);
    // Simulate OTP send
    setStep('verification');
  };

  const handleVerificationCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newCode = [...verificationCode];

      if (newCode[index]) {
        // If current box has value, clear it
        newCode[index] = '';
        setVerificationCode(newCode);
      } else if (index > 0) {
        // If current box is empty, move to previous and clear it
        newCode[index - 1] = '';
        setVerificationCode(newCode);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleConfirmCode = () => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setError('');
    // Simulate verification
    setStep('newPassword');
  };

  const handleResendCode = () => {
    if (resendTimer > 0) return;
    setVerificationCode(['', '', '', '', '', '']);
    setError('');
    setResendTimer(75);
    setShowResendToast(true);
    inputRefs.current[0]?.focus();
  };

  const handleUpdatePassword = () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    // Show success modal
    setStep('success');
  };

  const handleSuccessLogin = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="forgot-password-overlay">
      <div className="forgot-password-modal">
        {step === 'reset' && (
          <>
            <div className="modal-header">
              <h3>Reset your password</h3>
              <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Enter the email you signed up with and we'll send a link to set a new password.
              </p>
              <label className="forgot-field">
                <span>Email address</span>
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                />
              </label>
              {error && <p className="error-hint">{error}</p>}
              <p className="tip-text">Tip: try unknown@email.com to see the error state</p>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleSendOTP}>
                Send OTP Verification
              </button>
            </div>
          </>
        )}

        {step === 'verification' && (
          <>
            <div className="modal-header">
              <h3>Verification code</h3>
              <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                We have sent a verification code to your email
              </p>
              <div className="verification-inputs">
                {verificationCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    name={`code-${index}`}
                    value={digit}
                    onChange={e => handleVerificationCodeChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className="code-input"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              {error && <p className="error-hint">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleConfirmCode}>
                Confirm
              </button>
              <button
                className="btn-link"
                onClick={handleResendCode}
                disabled={resendTimer > 0}
                style={{ opacity: resendTimer > 0 ? 0.5 : 1 }}
              >
                {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : 'Resend Code'}
              </button>
            </div>
            {showResendToast && (
              <div className="resend-toast">
                ✓ Code sent successfully
              </div>
            )}
          </>
        )}

        {step === 'newPassword' && (
          <>
            <div className="modal-header">
              <h3>Create new password</h3>
              <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Your identity is verified. Please provide a strong new password.
              </p>
              <label className="forgot-field">
                <span>New Password</span>
                <div className="password-input-wrap">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="eye-toggle"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showNewPassword} />
                  </button>
                </div>
              </label>
              <label className="forgot-field">
                <span>Confirm New Password</span>
                <div className="password-input-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="eye-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showConfirmPassword} />
                  </button>
                </div>
              </label>
              {error && <p className="error-hint">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleUpdatePassword}>
                Update New Password
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="success-modal-content">
              <div className="success-icon">
                <svg viewBox="0 0 24 24" width="32" height="32">
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/>
                </svg>
              </div>
              <h3 className="success-title">Password updated</h3>
              <p className="success-description">
                Log in with your new password. For safety, we signed you out of your other devices.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={handleSuccessLogin}>
                Log in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
