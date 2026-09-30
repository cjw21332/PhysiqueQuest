'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LaunchPage() {
  const router = useRouter();
  const [notice, setNotice] = useState('');

  const handleGetStarted = () => {
    router.push('/register');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <main className="scene">
      <div className="app-shell">
        <section className="launch screen-enter">
          <div className="launch-brand">
            <div className="brand-mark">PQ</div>
            <h1>PhysiqueQuest</h1>
            <p className="subtitle">AI-assisted, gamified fitness coaching that watches your form.</p>
          </div>
          <div className="launch-spacer" />
          <div className="readiness">
            <div className="readiness-head">
              <b>Device readiness</b>
              <span>2 of 3 ready</span>
            </div>
            <div className="ready-row">
              <b className="ready-icon">✓</b>
              <p>
                Android 12 or higher
                <small>Android 14 detected</small>
              </p>
            </div>
            <div className="ready-row">
              <b className="ready-icon">✓</b>
              <p>
                High-speed Wi-Fi
                <small>Connected · 84 Mbps</small>
              </p>
            </div>
            <div className="ready-row">
              <b className="camera-icon">◎</b>
              <p>
                Camera permission
                <small>Needed for form tracking</small>
              </p>
              <button
                className="allow"
                onClick={() =>
                  setNotice('Camera access can be enabled when you start a camera-guided workout.')
                }
              >
                Allow
              </button>
            </div>
          </div>
          <div className="launch-actions">
            <button className="primary" onClick={handleGetStarted}>
              Get started
            </button>
            <button className="secondary" onClick={handleLogin}>
              I already have an account
            </button>
          </div>
        </section>
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
  );
}
