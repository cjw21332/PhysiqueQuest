'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import { appVersionHeaders, session } from '../../lib/session';

export default function VerifyEmailPage() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('Open the verification link from your email, then confirm below.');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const readToken = () => {
      const incoming = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (incoming) { setToken(incoming); window.history.replaceState(null, '', '/verify-email'); }
    };
    readToken();
    window.addEventListener('hashchange', readToken);
    setEmail(session.current()?.email || '');
    return () => window.removeEventListener('hashchange', readToken);
  }, []);
  async function submit(confirm: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/verification/${confirm ? 'confirm' : 'request'}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...appVersionHeaders() }, body: JSON.stringify(confirm ? { token } : { email }), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw Error(response.status === 429 ? 'Wait a minute before requesting another email.' : 'The link is invalid or expired, or delivery is unavailable. Request a new email.');
      const result = await response.json();
      if (confirm) {
        setToken(''); setMessage('Email verified. You can continue.');
        try { await session.refresh(getApiBaseUrl()); }
        catch { setMessage('Email verified. Sign in again to update your session.'); }
      } else if (['unavailable', 'console'].includes(result.developmentDelivery)) {
        setMessage('Local email delivery is not configured for an inbox. Start Mailpit and set MAIL_PROVIDER=mailpit on the backend, then request another email.');
      } else setMessage(result.developmentDelivery === 'mailpit'
        ? 'If this address needs verification, open the message in your local Mailpit inbox and follow its verification link.'
        : 'If this address needs verification, an email has been sent. Check your inbox and spam folder, then open the link.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not verify. Check your connection.'); }
    finally { setBusy(false); }
  }
  return <main className="scene"><div className="app-shell"><section className="verification-page"><h1>Verify your email</h1><p>Send a verification email, open its link, then select Confirm email.</p><p role="status">{message}</p>{token && <button className="primary" disabled={busy} onClick={() => void submit(true)}>Confirm email</button>}<form onSubmit={event => { event.preventDefault(); void submit(false); }}><label className="field"><span>Email address</span><div className="input-wrap"><input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></div></label><button className="primary" disabled={busy} type="submit">{busy ? 'Please wait…' : 'Send verification email'}</button></form><Link href="/home">Continue to app</Link><Link href="/login">Sign in</Link></section></div></main>;
}
