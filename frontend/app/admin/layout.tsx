'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, getApiBaseUrl } from '../../lib/api';
import { clearAuthSession, markSignedOut, session, signedOutByUser } from '../../lib/session';
import { loginAsAdmin, logout } from '../../lib/auth';
import ForgotPasswordFlow from '../../sections/Forgot Password/ForgotPasswordFlow';
import { Icon, errorText } from './ui';
import './admin.css';

const nav: { group: string; links: [string, string, string][] }[] = [
  { group: 'Monitor', links: [['Overview', '/admin', 'overview'], ['Users', '/admin/users', 'users']] },
  { group: 'Feedback', links: [['App feedback', '/admin/feedback', 'inbox'], ['Exercise feedback', '/admin/exercises', 'dumbbell']] },
  { group: 'Insights', links: [['Food analytics', '/admin/food', 'food'], ['PoseTracker accuracy', '/admin/pose-tracker', 'target']] },
  { group: 'Manage', links: [['Exercise references', '/admin/pose-tracker/references', 'sliders'], ['Audit & system', '/admin/audit', 'shield']] },
];

type Gate = 'loading' | 'login' | 'change' | 'ready';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/admin';
  const [state, setState] = useState<Gate>('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  async function check() {
    try {
      const user = await api.getAuthMe();
      if (user.role !== 'admin') { clearAuthSession(); setError('This account does not have administrator access.'); setState('login'); return; }
      setState(user.mustChangePassword ? 'change' : 'ready');
    } catch { setState('login'); }
  }

  useEffect(() => { void (async () => {
    try { if (!session.current() && !signedOutByUser()) await session.restore(getApiBaseUrl()); } catch { setState('login'); return; }
    if (session.current()) await check(); else setState('login');
  })(); }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await loginAsAdmin(username.trim().toLowerCase(), password); setPassword(''); await check(); }
    catch (e) {
      const message = errorText(e, 'Unable to sign in.');
      setError(/invalid (email|username) or password/i.test(message) ? 'Incorrect username or password.' : message);
    }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { setError('The new passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      await api.changeInitialAdminPassword(password, newPassword);
      clearAuthSession(); markSignedOut(true); setPassword(''); setNewPassword(''); setConfirmation('');
      setNotice('Password changed. Sign in with your new password.'); setState('login');
    } catch (e) { setError(errorText(e, 'Could not change the password.')); }
    finally { setBusy(false); }
  }

  async function signOut() { await logout(); setUsername(''); setNotice('You have been signed out.'); setState('login'); }

  if (state === 'loading') return <main className="adm-root adm-boot"><span className="adm-spinner" aria-hidden="true" /><p role="status">Checking your session…</p></main>;

  if (state !== 'ready') return <main className="adm-root adm-login">
    <section className="adm-login-brand" aria-hidden="true">
      <div className="adm-logo"><img src="/physiquequest-icon.png" alt="" width={40} height={40} /><span>PhysiqueQuest<small>Admin console</small></span></div>
      <div className="adm-login-pitch">
        <p className="adm-eyebrow">Command centre</p>
        <h1>Every rep, meal and message.<br /><em>One screen.</em></h1>
        <ul>
          <li><Icon name="users" /> User analytics and profiles</li>
          <li><Icon name="inbox" /> App and exercise feedback</li>
          <li><Icon name="target" /> PoseTracker accuracy per exercise</li>
        </ul>
      </div>
      <p className="adm-login-foot">Restricted to the PhysiqueQuest administrator</p>
    </section>
    <section className="adm-login-panel">
      {state === 'login' ? <form className="adm-login-form" onSubmit={signIn}>
        <h2>Sign in</h2>
        <p className="adm-sub">Use the administrator username and password.</p>
        <label className="adm-field">Username<input name="username" autoComplete="username" required autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" aria-invalid={Boolean(error)} /></label>
        <label className="adm-field">Password
          <span className="adm-password">
            <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} aria-invalid={Boolean(error)} />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><Icon name={showPassword ? 'eyeOff' : 'eye'} /></button>
          </span>
        </label>
        <div className="adm-login-row"><button type="button" className="adm-link" onClick={() => { setError(''); setForgot(true); }}>Forgot password?</button></div>
        {error && <p role="alert" className="adm-form-error"><Icon name="alert" size={16} />{error}</p>}
        {notice && <p role="status" className="adm-form-notice">{notice}</p>}
        <button className="adm-btn adm-btn-primary adm-btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="adm-login-help">Forgot it? A reset code is emailed to the administrator&apos;s registered address.</p>
      </form> : <form className="adm-login-form" onSubmit={changePassword}>
        <h2>Set a new password</h2>
        <p className="adm-sub">Choose a new password before opening the dashboard: 8–15 characters with an uppercase letter, a lowercase letter and a number.</p>
        <label className="adm-field">Current password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="adm-field">New password<input type="password" autoComplete="new-password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
        <label className="adm-field">Confirm new password<input type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        {error && <p role="alert" className="adm-form-error"><Icon name="alert" size={16} />{error}</p>}
        <button className="adm-btn adm-btn-primary adm-btn-block" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>}
    </section>
    {forgot && <ForgotPasswordFlow onClose={() => setForgot(false)} onSuccess={() => { setForgot(false); setNotice('Password reset. Sign in with your new password.'); }} />}
  </main>;

  const active = (url: string) => url === '/admin' || url === '/admin/pose-tracker' ? pathname === url : pathname.startsWith(url);
  return <div className="adm-root adm-shell">
    <a className="adm-skip" href="#adm-main">Skip to content</a>
    <aside className="adm-sidebar">
      <Link href="/admin" className="adm-logo"><img src="/physiquequest-icon.png" alt="" width={34} height={34} /><span>PhysiqueQuest<small>Admin console</small></span></Link>
      <nav aria-label="Admin sections">
        {nav.map(section => <div key={section.group} className="adm-nav-group">
          <p>{section.group}</p>
          {section.links.map(([label, url, icon]) => <Link key={url} href={url} className={active(url) ? 'is-active' : ''} aria-current={active(url) ? 'page' : undefined}><Icon name={icon} />{label}</Link>)}
        </div>)}
      </nav>
      <div className="adm-account">
        <span className="adm-avatar">A</span>
        <span className="adm-account-name">admin<small>Administrator</small></span>
        <button type="button" className="adm-btn adm-btn-ghost adm-btn-icon" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
      </div>
    </aside>
    <div className="adm-main" id="adm-main" tabIndex={-1}>{children}</div>
  </div>;
}
