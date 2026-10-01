'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Home/icons';
import BottomNav from '../Home/BottomNav';
import type { Profile } from '../Home/types';
import AdminExerciseLibrary from './AdminExerciseLibrary';
import EngagementAnalytics from './EngagementAnalytics';

type Settings = { inactivity: boolean; alarmVolume: boolean; showLeaderboard: boolean; threshold: 30 | 45 | 60 };
type AdminView = 'settings' | 'exercises' | 'engagement';
const initialSettings: Settings = { inactivity: true, alarmVolume: true, showLeaderboard: true, threshold: 45 };

function Switch({ label, checked, onChange, tone = 'green' }: { label: string; checked: boolean; onChange: () => void; tone?: 'green' | 'red' }) {
  return <button className={`me-switch ${tone} ${checked ? 'on' : ''}`} type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onChange}><i/></button>;
}

function ProfileSilhouette() {
  return <span className="me-avatar" aria-hidden="true"><svg viewBox="0 0 48 56"><path d="M17 8 24 5l7 3 3 8-3 5 2 4 6 3 4 7 1 17H4l1-17 4-7 6-3 2-4-3-5z"/><path d="m17 8 7 6 7-6M18 21l6 4 6-4M14 27l10 4 10-4M17 34l7 3 7-3M12 44h24" fill="none" stroke="#f4f6f3" strokeWidth="1.2" opacity=".8"/><path d="M21 13h6v5h-6z" fill="#f4f6f3" opacity=".7"/></svg></span>;
}

function SettingRow({ icon, title, detail, onClick, danger = false }: { icon: string; title: string; detail: string; onClick: () => void; danger?: boolean }) {
  return <button className={`me-row ${danger ? 'danger' : ''}`} type="button" onClick={onClick}>
    <span className="me-row-icon"><Icon name={icon} size={14}/></span>
    <span className="me-row-copy"><b>{title}</b><small>{detail}</small></span>
    <Icon name="arrow" size={14}/>
  </button>;
}

export default function MeSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [adminView, setAdminView] = useState<AdminView>('settings');
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setReady(true);
    try {
      const saved = localStorage.getItem('physiquequest-me-settings');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Settings>;
        setSettings({
          inactivity: typeof parsed.inactivity === 'boolean' ? parsed.inactivity : initialSettings.inactivity,
          alarmVolume: typeof parsed.alarmVolume === 'boolean' ? parsed.alarmVolume : initialSettings.alarmVolume,
          showLeaderboard: typeof parsed.showLeaderboard === 'boolean' ? parsed.showLeaderboard : initialSettings.showLeaderboard,
          threshold: parsed.threshold === 30 || parsed.threshold === 45 || parsed.threshold === 60 ? parsed.threshold : initialSettings.threshold,
        });
      }
    } catch { /* Keep the default settings if stored browser data is unavailable. */ }
  }, []);

  useEffect(() => { if (ready) localStorage.setItem('physiquequest-me-settings', JSON.stringify(settings)); }, [settings, ready]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const toggle = (key: 'inactivity' | 'alarmVolume' | 'showLeaderboard') => setSettings(current => ({ ...current, [key]: !current[key] }));
  const equipment = profile.equipment?.length ? profile.equipment.join(', ') : 'Dumbbells';
  const daysPerWeek = profile.days?.length || 4;
  const conditionCount = profile.conditions?.includes('None of these') ? 0 : profile.conditions?.length || 1;
  const goalWeight = profile.targetWeight ? `${profile.targetWeight} kg` : '74 kg';

  if (adminView === 'exercises') {
    return <AdminExerciseLibrary onBack={() => setAdminView('settings')} />;
  }
  if (adminView === 'engagement') {
    return <EngagementAnalytics onBack={() => setAdminView('settings')} />;
  }

  return <section className="me-section" aria-label="Account and settings">
    <header className="me-header"><h2>Account &amp; settings</h2></header>
    <div className="me-scroll">
      <div className="me-profile-summary">
        <ProfileSilhouette/>
        <div className="me-profile-name"><b>{profile.name || 'Toji Dela Cruz'}</b><small>Level 7 · member since Aug 2026</small></div>
        <button className="me-edit" onClick={() => setNotice('Profile editing is coming soon.')}>Edit</button>
      </div>

      <h3 className="me-group-title">Profile</h3>
      <div className="me-list">
        <SettingRow icon="user" title="Personal data" detail="Age, height, weight, measurements" onClick={() => setNotice('Personal data editing is coming soon.')}/>
        <SettingRow icon="target" title="Goals" detail={`${profile.goal || 'Build muscle'} · ${goalWeight} by Mar 2027`} onClick={() => setNotice('Goal editing is coming soon.')}/>
        <SettingRow icon="dumbbell" title="Training preference" detail={`${equipment} · ${daysPerWeek} days · ${profile.duration || '45 min'}`} onClick={() => setNotice('Training preference editing is coming soon.')}/>
        <SettingRow icon="health" title="Health profile" detail={`${conditionCount} ${conditionCount === 1 ? 'condition' : 'conditions'} logged`} onClick={() => setNotice('Health profile editing is coming soon.')}/>
      </div>

      <h3 className="me-group-title safety">Safety</h3>
      <div className="me-list">
        <SettingRow icon="phone" title="Emergency contact" detail={profile.contactName || 'Maria Dela Cruz'} onClick={() => setNotice('Emergency contact editing is coming soon.')} danger/>
      </div>
      <div className="me-setting-row"><span><b>Inactivity monitoring</b><small>Armed during every session</small></span><Switch label="Inactivity monitoring" checked={settings.inactivity} onChange={() => toggle('inactivity')}/></div>

      <div className="me-divider"/>
      <section className="me-setting-block">
        <h3 className="me-group-title">Inactivity threshold</h3>
        <p>Time without movement before we check on you</p>
        <div className="me-threshold" role="group" aria-label="Inactivity threshold">
          {([30, 45, 60] as const).map(value => <button key={value} className={settings.threshold === value ? 'selected' : ''} onClick={() => setSettings(current => ({ ...current, threshold: value }))}>{value} s</button>)}
        </div>
      </section>
      <div className="me-setting-row"><span><b>Maximum alarm volume</b><small>Overrides silent mode</small></span><Switch label="Maximum alarm volume" checked={settings.alarmVolume} onChange={() => toggle('alarmVolume')}/></div>

      <h3 className="me-group-title me-privacy-title">Privacy</h3>
      <div className="me-setting-row"><span><b>Show me on leaderboard</b><small>Friends can see your rank and points</small></span><Switch label="Show me on leaderboard" checked={settings.showLeaderboard} onChange={() => toggle('showLeaderboard')}/></div>

      <h3 className="me-group-title me-admin-title">Admin tools</h3>
      <div className="me-list">
        <SettingRow icon="dumbbell" title="Exercise library" detail="Publish exercises and pose templates" onClick={() => setAdminView('exercises')}/>
        <SettingRow icon="trend" title="Engagement Analytics" detail="Users, sessions, safety events" onClick={() => setAdminView('engagement')}/>
      </div>

      <button className="me-logout" onClick={() => onLogoutRequest?.()}><span>⇥</span>Log out</button>
    </div>
    <BottomNav />
    {notice && <div className="home-toast me-toast" role="status">{notice}</div>}
  </section>;
}
