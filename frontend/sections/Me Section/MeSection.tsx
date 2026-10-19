'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Home/icons';
import BottomNav from '../Home/BottomNav';
import { api } from '../../lib/api';
import { PROFILE_STORAGE_KEY } from '../../lib/auth';
import type { Profile } from '../Home/types';
import AdminExerciseLibrary from './AdminExerciseLibrary';
import EngagementAnalytics from './EngagementAnalytics';
import PersonalDataEdit from './PersonalDataEdit';
import GoalsEdit from './GoalsEdit';
import TrainingPreferenceEdit from './TrainingPreferenceEdit';
import HealthProfileEdit from './HealthProfileEdit';
import EmergencyContactEdit from './EmergencyContactEdit';
import { useSettings } from '../../hooks/useSettings';
import { normalizeTrainingDays } from '../../lib/trainingDays';
import ForgotPasswordFlow from '../Forgot Password/ForgotPasswordFlow';

type MeView = 'settings' | 'exercises' | 'engagement' | 'edit-personal' | 'edit-goals' | 'edit-training' | 'edit-health' | 'edit-emergency';

function Switch({ label, checked, onChange, tone = 'green' }: { label: string; checked: boolean; onChange: () => void; tone?: 'green' | 'red' }) {
  return <button className={`me-switch ${tone} ${checked ? 'on' : ''}`} type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onChange}><i/></button>;
}

function SettingRow({ icon, title, detail, onClick, danger = false }: { icon: string; title: string; detail: string; onClick: () => void; danger?: boolean }) {
  return <button className={`me-row ${danger ? 'danger' : ''}`} data-icon={icon} type="button" onClick={onClick}>
    <span className="me-row-icon"><Icon name={icon} size={14}/></span>
    <span className="me-row-copy"><b>{title}</b><small>{detail}</small></span>
    <Icon name="arrow" size={14}/>
  </button>;
}

export default function MeSection({ profile, onLogoutRequest }: { profile: Profile; onLogoutRequest?: () => void }) {
  const { settings, loading: settingsLoading, error: settingsError, updateSettings, retry: retrySettings } = useSettings();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(profile);
  const [view, setView] = useState<MeView>('settings');
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');
  const [level, setLevel] = useState<number | null>(null);
  useEffect(() => { let active = true; api.getActivity().then(result => { if (active && Number.isFinite(result.state?.level)) setLevel(result.state.level); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { setCurrentProfile(profile); }, [profile]);

  const toggle = async (key: 'inactivity' | 'alarmVolume' | 'showLeaderboard') => { try { await updateSettings({ [key]: !settings[key] }); } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save settings.'); } };
  const equipment = currentProfile.equipment?.length ? currentProfile.equipment.join(', ') : '—';
  const selectedTrainingDays = normalizeTrainingDays(currentProfile.days || []);
  const daysPerWeek = selectedTrainingDays.length;
  const conditionCount = currentProfile.conditions?.includes('None of these') ? 0 : (currentProfile.conditions?.length ?? 0);
  const weightUnit = currentProfile.weightUnit || '';
  const goalWeight = currentProfile.targetWeight ? `${currentProfile.targetWeight} ${weightUnit}`.trim() : '—';
  const memberSince = currentProfile.createdAt
    ? new Date(currentProfile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const targetDate = currentProfile.targetDate
    ? new Date(currentProfile.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';
  const goalDetail = `${currentProfile.goal || '—'} · ${goalWeight} by ${targetDate}`;

  // Persist a partial profile update to the database (MongoDB via the
  // JWT-guarded PUT /api/profile endpoint), then refresh the cached copy
  // so every screen reads the new value without a reload.
  const saveProfile = async (patch: Partial<Profile>, featureName = 'Profile') => {
    setSaveError('');
    try {
      const updated = await api.updateProfile(patch);
      const merged = { ...currentProfile, ...patch, ...updated };
      setCurrentProfile(merged);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event('physiquequest-profile-updated'));
      setNotice(`${featureName} saved`);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save. Please try again.');
      return false;
    }
  };

  if (view === 'edit-personal') return <PersonalDataEdit profile={currentProfile} error={saveError} onBack={() => { setSaveError(''); setView('settings'); }} onSave={patch => saveProfile(patch, 'Personal data edit')} />;
  if (view === 'edit-goals') return <GoalsEdit profile={currentProfile} error={saveError} onBack={() => { setSaveError(''); setView('settings'); }} onSave={patch => saveProfile(patch, 'Goals edit')} />;
  if (view === 'edit-training') return <TrainingPreferenceEdit profile={currentProfile} error={saveError} onBack={() => { setSaveError(''); setView('settings'); }} onSave={patch => saveProfile(patch, 'Training preference edit')} />;
  if (view === 'edit-health') return <HealthProfileEdit profile={currentProfile} error={saveError} onBack={() => { setSaveError(''); setView('settings'); }} onSave={patch => saveProfile(patch, 'Health profile edit')} />;
  if (view === 'edit-emergency') return <EmergencyContactEdit profile={currentProfile} error={saveError} onBack={() => { setSaveError(''); setView('settings'); }} onSave={patch => saveProfile(patch, 'Emergency contact edit')} />;

  if (view === 'exercises') {
    return <AdminExerciseLibrary onBack={() => setView('settings')} />;
  }
  if (view === 'engagement') {
    return <EngagementAnalytics preview onBack={() => setView('settings')} />;
  }

  return <section className="me-section me-reference" aria-label="Account and settings">
    <header className="me-header"><h2>Account &amp; settings</h2></header>
    <div className="me-scroll">
      <div className="me-profile-summary">
        <span className="me-avatar me-reference-avatar" aria-hidden="true"/>
        <div className="me-profile-name"><b>{currentProfile.name || '—'}</b><small>{level !== null ? `Level ${level} · ` : ''}member since {memberSince}</small></div>
        <button className="me-edit" onClick={() => setView('edit-personal')}>Edit</button>
      </div>

      <h3 className="me-group-title">Profile</h3>
      <div className="me-list">
        <SettingRow icon="user" title="Personal data" detail="Age, height, weight, measurements" onClick={() => setView('edit-personal')}/>
        <SettingRow icon="target" title="Goals" detail={goalDetail} onClick={() => setView('edit-goals')}/>
        <SettingRow icon="library-dumbbells" title="Training preference" detail={`${equipment} · ${daysPerWeek} day${daysPerWeek === 1 ? '' : 's'} · ${currentProfile.duration || '—'}`} onClick={() => { setSaveError(''); setView('edit-training'); }}/>
        <SettingRow icon="health" title="Health profile" detail={`${conditionCount} condition${conditionCount === 1 ? '' : 's'} logged`} onClick={() => setView('edit-health')}/>
      </div>

      <h3 className="me-group-title safety">Safety</h3>
      <div className="me-list">
        <SettingRow icon="phone" title="Emergency contact" detail={currentProfile.contactName || '—'} onClick={() => setView('edit-emergency')} danger/>
      </div>
      {(settingsError || saveError) && <p className="error" role="alert">{settingsError || saveError}</p>}
      {settingsLoading ? <p className="hint" role="status">Loading saved settings…</p> : settingsError ? <button type="button" className="secondary" onClick={() => void retrySettings()}>Retry settings</button> : <><div className="me-setting-row"><span><b>Inactivity monitoring</b><small>Armed during every session</small></span><Switch label="Inactivity monitoring" checked={settings.inactivity} onChange={() => void toggle('inactivity')}/></div>

      <div className="me-divider"/>
      <section className="me-setting-block">
        <h3 className="me-group-title">Inactivity threshold</h3>
        <p>Time without movement before we check on you</p>
        <div className="me-threshold" role="group" aria-label="Inactivity threshold">
          {([30, 45, 60] as const).map(value => <button key={value} className={settings.threshold === value ? 'selected' : ''} onClick={() => { void updateSettings({ threshold: value }).catch(error => setSaveError(error instanceof Error ? error.message : 'Could not save threshold.')); }}>{value} s</button>)}
        </div>
      </section>
      <div className="me-setting-row"><span><b>Emergency alarm volume</b><small>Maximum volume in the Android app. Device volume applies on iOS, web, and Expo Go; system restrictions may limit sound.</small></span></div>

      <h3 className="me-group-title me-privacy-title">Privacy</h3>
      <div className="me-setting-row"><span><b>Show me on leaderboard</b><small>Friends can see your rank and points</small></span><Switch label="Show me on leaderboard" checked={settings.showLeaderboard} onChange={() => void toggle('showLeaderboard')}/></div></>}

      <h3 className="me-group-title">Security</h3><div className="me-list"><SettingRow icon="key" title="Change password" detail={`Verified with a code sent to ${currentProfile.email}`} onClick={() => setPasswordOpen(true)}/></div>
      <h3 className="me-group-title me-admin-title">Admin tools</h3><div className="me-list">
        <SettingRow icon="exercise-books" title="Exercise library" detail="Publish exercises and pose templates" onClick={() => setView('exercises')}/>
        <SettingRow icon="chart-bars" title="Engagement analytics" detail="Users, sessions, safety events" onClick={() => setView('engagement')}/>
      </div>

      <button className="me-logout" onClick={() => onLogoutRequest?.()}><Icon name="logout" size={17}/>Log out</button>
    </div>
    <BottomNav />
    {passwordOpen && <ForgotPasswordFlow mode="change" accountEmail={currentProfile.email} onClose={() => setPasswordOpen(false)} onSuccess={() => { setPasswordOpen(false); setNotice('Password updated. Sign in again with your new password.'); onLogoutRequest?.(); }}/>}
    {notice && <div className="home-toast me-toast" role="status">{notice}</div>}
  </section>;
}
