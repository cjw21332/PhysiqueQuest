'use client';
import { useState } from 'react';
import type { Profile } from '../Home/types';
import MeEditLayout from './MeEditLayout';
import { Icon } from '../Home/icons';

// Extend profile type locally if it doesn't have it yet to prevent TS errors.
// It will be saved normally in localStorage/API since it's just JSON.
type ExtendedProfile = Profile & { contactRelationship?: string };

type Props = {
  profile: ExtendedProfile;
  onBack: () => void;
  onSave: (patch: Partial<ExtendedProfile>) => Promise<boolean>;
  error?: string;
};

const relationshipOptions = ['Parent', 'Partner', 'Sibling', 'Friend', 'Other'];

export default function EmergencyContactEdit({ profile, onBack, onSave, error }: Props) {
  const [data, setData] = useState({
    contactName: profile.contactName || '',
    contactPhone: profile.contactPhone || '',
    contactRelationship: profile.contactRelationship || '',
  });
  const [saving, setSaving] = useState(false);

  const isDirty = data.contactName !== (profile.contactName || '') ||
    data.contactPhone !== (profile.contactPhone || '') ||
    data.contactRelationship !== (profile.contactRelationship || '');

  const setField = (key: keyof typeof data, value: string) => setData(curr => ({ ...curr, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try { if (await onSave(data)) onBack(); } finally { setSaving(false); }
  };

  return (
    <MeEditLayout
      title="Emergency contact"
      description={<span className="me-required-description">Who we alert if something goes wrong.<small className="required">Required</small></span>}
      onBack={onBack}
      onDiscard={onBack}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={saving}
      error={error}
    >
      <div className="safety-note emergency-contact-note">
        <span><Icon name="shield" size={16} /></span>
        <p>If you stop moving during a session and don't respond, we'll alert this person with your location when alert delivery is configured.</p>
      </div>

      <label className="field">
        <span>Name</span>
        <div className="input-wrap">
          <input value={data.contactName} onChange={e => setField('contactName', e.target.value)} autoComplete="name" maxLength={100} />
        </div>
      </label>

      <label className="field">
        <span>Mobile number</span>
        <div className="input-wrap">
          <input type="tel" value={data.contactPhone} onChange={e => setField('contactPhone', e.target.value)} autoComplete="tel" maxLength={30} />
        </div>
      </label>

      <small className="me-phone-hint">Include the country code, e.g. +63</small>
      <div className="choice-group">
        <b>Relationship</b>
        <div className="chips relationship-chips">
          {relationshipOptions.map(option => (
            <button type="button" key={option} className={`chip ${data.contactRelationship === option ? 'active' : ''}`} aria-pressed={data.contactRelationship === option} onClick={() => setField('contactRelationship', option)}>{option}</button>
          ))}
        </div>
      </div>
    </MeEditLayout>
  );
}
