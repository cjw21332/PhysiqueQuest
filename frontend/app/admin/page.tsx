"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import EngagementAnalytics from '../../sections/Me Section/EngagementAnalytics';

// The analytics API enforces the admin role; this check only spares other
// accounts a dashboard that would load into an access error.
export default function AdminDashboard() {
  const router = useRouter();
  const [access, setAccess] = useState<'checking' | 'admin' | 'denied' | 'offline'>('checking');
  useEffect(() => {
    let active = true;
    api.getAuthMe().then(user => { if (active) setAccess(user.role === 'admin' ? 'admin' : 'denied'); }).catch(() => { if (active) setAccess('offline'); });
    return () => { active = false; };
  }, []);
  const back = () => router.push('/home');
  if (access === 'admin') return <main className="scene"><EngagementAnalytics onBack={back}/></main>;
  return <main className="scene"><section className="admin-access-state">
    {access === 'checking' ? <p role="status">Checking administrator access…</p> : <>
      <h1>Admin analytics</h1>
      <p role="alert">{access === 'denied' ? 'Administrator access is required to view this page.' : 'Could not confirm your access. Check your connection and sign in again.'}</p>
      <button type="button" className="secondary" onClick={back}>Back to home</button>
    </>}
  </section></main>;
}
