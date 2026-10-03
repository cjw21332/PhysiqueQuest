'use client';

import { useState } from 'react';
import { Icon } from '../Home/icons';
import BottomNav from '../Home/BottomNav';
import { api } from '../../lib/api';
import { PROFILE_STORAGE_KEY } from '../../lib/auth';
import type { Profile } from '../Home/types';
import AdminExerciseLibrary from './AdminExerciseLibrary';
import EngagementAnalytics from './EngagementAnalytics';
import { useSettings } from '../../hooks/useSettings';

type Settings = { inactivity: boolean; alarmVolume: boolean; showLeaderboard: boolean; threshold: 30 | 45 | 60 };
type AdminView = 'settings' | 'exercises' | 'engagement';

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
  const { settings, loading: settingsLoading, error: settingsError, updateSettings } = useSettings();
  const [adminView, setAdminView] = useState<AdminView>('settings');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const toggle = async (key: 'inactivity' | 'alarmVolume' | 'showLeaderboard') => { try { await updateSettings({ [key]: !settings[key] }); } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save settings.'); } };
  const equipment = profile.equipment?.length ? profile.equipment.join(', ') : '—';
  const daysPerWeek = profile.days?.length ?? 0;
  const conditionCount = profile.conditions?.includes('None of these') ? 0 : (profile.conditions?.length ?? 0);
  const weightUnit = profile.weightUnit || '';
  const goalWeight = profile.targetWeight ? `${profile.targetWeight} ${weightUnit}`.trim() : '—';
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const targetDate = profile.targetDate
    ? new Date(profile.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const goalDetail = `${profile.goal || '—'} · ${goalWeight} by ${targetDate}`;

  // Persist a partial profile update to the database (MongoDB via the
  // JWT-guarded PUT /api/profile endpoint), then refresh the cached copy
  // so every screen reads the new value without a reload.
  const saveProfile = async (patch: Partial<Profile>, featureName = 'Profile') => {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await api.updateProfile(patch);
      const merged = { ...profile, ...patch, ...updated };
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event('physiquequest-profile-updated'));
      setNotice(`${featureName} saved`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
        <div className="me-profile-name"><b>{profile.name || '—'}</b><small>member since {memberSince}</small></div>
        <button className="me-edit" onClick={() => saveProfile({ name: profile.name })}>Edit</button>
      </div>

      <h3 className="me-group-title">Profile</h3>
      <div className="me-list">
        <SettingRow icon="user" title="Personal data" detail={`Age ${profile.age ?? '—'} · ${profile.height ?? '—'} ${profile.heightUnit || ''} · ${profile.weight ?? '—'} ${weightUnit}`.replace(/\s+/g, ' ').trim()} onClick={() => saveProfile({ age: profile.age, height: profile.height, weight: profile.weight }, 'Personal data edit')}/>
        <SettingRow icon="target" title="Goals" detail={goalDetail} onClick={() => saveProfile({ goal: profile.goal, targetWeight: profile.targetWeight, targetDate: profile.targetDate }, 'Goals edit')}/>
        <SettingRow icon="dumbbell" title="Training preference" detail={`${equipment} · ${daysPerWeek} day${daysPerWeek === 1 ? '' : 's'} · ${profile.duration || '—'}`} onClick={() => saveProfile({ equipment: profile.equipment, days: profile.days, duration: profile.duration }, 'Training preference edit')}/>
        <SettingRow icon="health" title="Health profile" detail={`${conditionCount} condition${conditionCount === 1 ? '' : 's'} logged`} onClick={() => saveProfile({ conditions: profile.conditions, healthNotes: profile.healthNotes }, 'Health profile edit')}/>
      </div>

      <h3 className="me-group-title safety">Safety</h3>
      <div className="me-list">
        <SettingRow icon="phone" title="Emergency contact" detail={`${profile.contactName || '—'} · ${profile.contactPhone || '—'}`} onClick={() => saveProfile({ contactName: profile.contactName, contactPhone: profile.contactPhone })} danger/>
      </div>
      {(settingsError || saveError) && <p className="error" role="alert">{settingsError || saveError}</p>}
      {settingsLoading ? <p className="hint">Loading saved settings…</p> : <><div className="me-setting-row"><span><b>Inactivity monitoring</b><small>Armed during every session</small></span><Switch label="Inactivity monitoring" checked={settings.inactivity} onChange={() => void toggle('inactivity')}/></div>

      <div className="me-divider"/>
      <section className="me-setting-block">
        <h3 className="me-group-title">Inactivity threshold</h3>
        <p>Time without movement before we check on you</p>
        <div className="me-threshold" role="group" aria-label="Inactivity threshold">
          {([30, 45, 60] as const).map(value => <button key={value} className={settings.threshold === value ? 'selected' : ''} onClick={() => void updateSettings({ threshold: value })}>{value} s</button>)}
        </div>
      </section>
      <div className="me-setting-row"><span><b>Maximum alarm volume</b><small>Overrides silent mode</small></span><Switch label="Maximum alarm volume" checked={settings.alarmVolume} onChange={() => void toggle('alarmVolume')}/></div>

      <h3 className="me-group-title me-privacy-title">Privacy</h3>
      <div className="me-setting-row"><span><b>Show me on leaderboard</b><small>Friends can see your rank and points</small></span><Switch label="Show me on leaderboard" checked={settings.showLeaderboard} onChange={() => void toggle('showLeaderboard')}/></div></>}

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
