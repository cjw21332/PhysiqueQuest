'use client';

type ModalKind = 'login-failed' | 'email-registered' | 'account-created';

type Props = {
  kind: ModalKind;
  name?: string;
  email?: string;
  locked?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
};

const content: Record<ModalKind, { title: string; description: string; primary: string; secondary?: string; icon: string }> = {
  'login-failed': {
    title: 'Incorrect email or password',
    description: 'Check your details and try again. After 5 failed attempts, sign-in pauses for 15 minutes.',
    primary: 'Try again',
    icon: 'lock',
  },
  'email-registered': {
    title: 'Email already registered',
    description: '',
    primary: 'Log in instead',
    secondary: 'Use another email',
    icon: 'user-remove',
  },
  'account-created': {
    title: 'Account created',
    description: '',
    primary: 'Start calibration',
    icon: 'user-check',
  },
};

export default function AuthOutcomeModal({ kind, name, email, locked = false, onPrimary, onSecondary }: Props) {
  const item = content[kind];
  const description = kind === 'login-failed' && locked
    ? 'Too many attempts. Sign-in is paused for 15 minutes. Reset your password to get back into your account sooner.'
    : kind === 'email-registered'
    ? `${email || 'This email'} already has a PhysiqueQuest account. Log in instead, or use a different email address you can access.`
    : kind === 'account-created'
      ? `Welcome to PhysiqueQuest, ${name?.trim() || 'there'}. Next, four quick steps to calibrate your plan — about two minutes.`
      : item.description;

  return <div className="auth-outcome-overlay">
    <section className={`auth-outcome-modal auth-outcome-${kind}`} role="dialog" aria-modal="true" aria-labelledby="auth-outcome-title" aria-describedby="auth-outcome-description">
      <div className={`auth-outcome-icon auth-outcome-icon-${kind}`}><AuthOutcomeIcon kind={kind} /></div>
      <h2 id="auth-outcome-title">{locked && kind === 'login-failed' ? 'Sign-in paused' : item.title}</h2>
      <p id="auth-outcome-description">{description}</p>
      <div className="auth-outcome-actions">
        <button className="auth-outcome-primary" type="button" onClick={onPrimary} autoFocus>{locked && kind === 'login-failed' ? 'Reset password' : item.primary}</button>
        {item.secondary && onSecondary && !(locked && kind === 'login-failed') && <button className="auth-outcome-secondary" type="button" onClick={onSecondary}>{item.secondary}</button>}
      </div>
    </section>
  </div>;
}

function AuthOutcomeIcon({ kind }: { kind: ModalKind }) {
  if (kind === 'login-failed') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
  if (kind === 'email-registered') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5m0-5-5 5"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="4"/><path d="m16 10 2 2 4-4"/></svg>;
}
