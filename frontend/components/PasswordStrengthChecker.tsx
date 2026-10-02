'use client';

interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  {
    id: 'length',
    label: '8-15 characters',
    test: (password) => password.length >= 8 && password.length <= 15,
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter (a-z)',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter (A-Z)',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least one number (0-9)',
    test: (password) => /[0-9]/.test(password),
  },
];

interface PasswordStrengthCheckerProps {
  password: string;
}

export default function PasswordStrengthChecker({ password }: PasswordStrengthCheckerProps) {
  if (!password) return null;

  return (
    <div className="password-requirements">
      <p className="requirements-title">Password must contain:</p>
      <ul className="requirements-list">
        {requirements.map((req) => {
          const isMet = req.test(password);
          return (
            <li key={req.id} className={isMet ? 'met' : 'unmet'}>
              <svg className="check-icon" viewBox="0 0 16 16" aria-hidden="true">
                {isMet ? (
                  <path d="M13.5 4L6 11.5L2.5 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ) : (
                  <rect x="4" y="4" width="8" height="8" rx="1" strokeWidth="1.5" fill="none" />
                )}
              </svg>
              <span className="requirement-label">{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function validatePassword(password: string): boolean {
  return requirements.every((req) => req.test(password));
}
