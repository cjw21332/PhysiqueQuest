'use client';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../lib/api';
import { appVersionHeaders, session } from '../../lib/session';

export default function VerifyEmailPage() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('Open the verification link from your email, then confirm below.');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
    window.history.replaceState(null, '', '/verify-email');
    setEmail(session.current()?.email || '');
  }, []);
  async function submit(confirm: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/verification/${confirm ? 'confirm' : 'request'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...appVersionHeaders() }, body: JSON.stringify(confirm ? { token } : { email }), signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw Error(response.status === 429 ? 'Wait a minute before requesting another email.' : 'The link is invalid or expired, or delivery is unavailable. Request a new email.');
      if (confirm) { await session.refresh(getApiBaseUrl()); setToken(''); setMessage('Email verified. You can continue.'); }
      else setMessage('If this address needs verification, an email has been sent. For local development, use Mailpit to open it.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not verify. Check your connection.'); }
    finally { setBusy(false); }
  }
  return <main className="app-shell"><h1>Verify your email</h1><p role="status">{message}</p>{token && <button disabled={busy} onClick={() => void submit(true)}>Confirm email</button>}<form onSubmit={event => { event.preventDefault(); void submit(false); }}><label>Email address<input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></label><button disabled={busy} type="submit">Send verification email</button></form><a href="/home">Continue to app</a><p><a href="/">Sign in</a></p></main>;
}
