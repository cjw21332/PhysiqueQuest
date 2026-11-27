'use client';
import { useState } from 'react';
import type { Profile } from '../Home/types';
import MeEditLayout from './MeEditLayout';
import { Icon } from '../Home/icons';

type Props = {
  profile: Profile;
  onBack: () => void;
  onSave: (patch: Partial<Profile>) => Promise<boolean>;
  error?: string;
};

import { INJURY_OPTIONS, RISK_OPTIONS, NONE_OF_THESE as NONE, healthPatch } from '../../lib/healthProfile';

const same = (a: string[], b: string[]) => a.length === b.length && a.every(item => b.includes(item));

export default function HealthProfileEdit({ profile, onBack, onSave, error }: Props) {
  const savedInjuries = profile.injuries ?? [], savedRisks = profile.healthRisks ?? [], savedConditions = profile.conditions || [];
  // Array.from keeps de-duplication working for every compile target.
  const saved = Array.from(new Set([...savedConditions, ...savedInjuries, ...savedRisks]));
  const [data, setData] = useState({
    selected: saved.some(item => item !== NONE) ? saved.filter(item => item !== NONE) : saved,
    healthConsentAt: (profile.healthConsentAt ?? null) as string | null,
    healthNotes: profile.healthNotes || '',
  });
  const [saving, setSaving] = useState(false);
  const { selected, healthConsentAt, healthNotes } = data;
  // Entries saved earlier that are not one of the listed options stay visible and editable.
  const others = saved.filter(item => item !== NONE && !INJURY_OPTIONS.includes(item) && !RISK_OPTIONS.includes(item));

  const patch = { ...healthPatch(selected, healthConsentAt, savedInjuries, savedRisks), healthConsentAt, healthNotes };
  const isDirty = healthConsentAt !== (profile.healthConsentAt ?? null) || healthNotes !== (profile.healthNotes || '') ||
    !same(patch.conditions, savedConditions) || !same(patch.injuries, savedInjuries) || !same(patch.healthRisks, savedRisks);

  const toggle = (value: string) => setData(current => {
    if (value === NONE) return { ...current, selected: current.selected.includes(NONE) ? [] : [NONE] };
    const next = current.selected.filter(item => item !== NONE);
    return { ...current, selected: next.includes(value) ? next.filter(item => item !== value) : [...next, value] };
  });
  const option = (label: string) => <label key={label} className="condition-checkbox"><input type="checkbox" checked={selected.includes(label)} onChange={() => toggle(label)} />{label}</label>;

  const handleSave = async () => {
    setSaving(true);
    try { if (await onSave(patch)) onBack(); } finally { setSaving(false); }
  };

  return (
    <MeEditLayout
      title="Health profile"
      description="Helps tailor exercise guidance to the conditions you select."
      onBack={onBack}
      onDiscard={onBack}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={saving}
      error={error}
    >
      <div className="choice-group condition-list">
        <div className="group-title"><b>Injuries</b></div>
        {INJURY_OPTIONS.map(option)}
        <div className="group-title"><b>Health conditions</b></div>
        {RISK_OPTIONS.map(option)}
        {others.length > 0 && <><div className="group-title"><b>Other</b></div>{others.map(option)}</>}
        {option(NONE)}
      </div>
      {selected.some(item => item === 'Heart condition' || item === 'Hypertension') && <div className="safety-note" role="note"><span><Icon name="shield" size={16} /></span><p>Get clearance from your doctor before starting. Stop at once and seek help if you feel chest pain, severe breathlessness, dizziness or an irregular heartbeat.</p></div>}

      <fieldset className="health-consent"><legend>Health-based coaching</legend>
        <p>When on, your Coach plan leaves out exercises that load the areas you selected. This does not guarantee an exercise is safe for you. Turning it off and saving removes these entries from coaching.</p>
        <label className="health-consent-toggle"><input type="checkbox" checked={Boolean(healthConsentAt)} onChange={({ target: { checked } }) => setData(current => ({ ...current, healthConsentAt: checked ? new Date().toISOString() : null }))}/> Allow health-based coaching</label>
      </fieldset>

      <div className="choice-group notes-group">
        <div className="group-title"><b>Additional information</b><small>Optional</small></div>
        <textarea value={healthNotes} onChange={e => setData(current => ({ ...current, healthNotes: e.target.value }))} maxLength={500} placeholder="Recent surgery, medication, anything your coach should know" />
      </div>
    </MeEditLayout>
  );
}
