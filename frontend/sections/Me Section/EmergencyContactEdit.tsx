'use client';
import { useState } from 'react';
import type { Profile } from '../Home/types';
import MeEditLayout from './MeEditLayout';
import { Icon } from '../Home/icons';
import { formatPhoneNumber } from '../../lib/phoneFormatter';

// Extend profile type locally if it doesn't have it yet to prevent TS errors.
// It will be saved normally in localStorage/API since it's just JSON.
type ExtendedProfile = Profile & { contactRelationship?: string };

type Props = {
  profile: ExtendedProfile;
  onBack: () => void;
  onSave: (patch: Partial<ExtendedProfile>) => Promise<void>;
};

const relationshipOptions = ['Parent', 'Partner', 'Sibling', 'Friend', 'Other'];

export default function EmergencyContactEdit({ profile, onBack, onSave }: Props) {
  const [data, setData] = useState({
    contactName: profile.contactName || '',
    contactPhone: formatPhoneNumber(profile.contactPhone || ''),
    contactRelationship: profile.contactRelationship || '',
  });
  const [saving, setSaving] = useState(false);

  const isDirty = data.contactName !== (profile.contactName || '') ||
    data.contactPhone !== (profile.contactPhone || '') ||
    data.contactRelationship !== (profile.contactRelationship || '');

  const setField = (key: keyof typeof data, value: string) => setData(curr => ({ ...curr, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(data);
    setSaving(false);
    onBack();
  };

  return (
    <MeEditLayout
      title="Emergency contact"
      description={<span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>Who we alert if something goes wrong.<small className="required" style={{ color: '#e53935' }}>Required</small></span>}
      onBack={onBack}
      onDiscard={onBack}
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={saving}
    >
      <div className="safety-note" style={{ marginBottom: '24px', background: '#effaf0', border: '1px solid #d8f0d9' }}>
        <span style={{ color: '#27743a', background: 'transparent' }}><Icon name="shield" size={16} /></span>
        <p style={{ color: '#15351d' }}>If you stop moving during a session and don't respond, we'll alert this person with your location.</p>
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
          <input type="tel" value={data.contactPhone} onChange={e => setField('contactPhone', formatPhoneNumber(e.target.value))} autoComplete="tel" placeholder="0999 999 9999" maxLength={13} />
        </div>
      </label>

      <div className="choice-group" style={{ marginTop: '24px' }}>
        <b>Relationship</b>
        <div className="chips">
          {relationshipOptions.map(option => (
            <button type="button" key={option} className={`chip ${data.contactRelationship === option ? 'active' : ''}`} aria-pressed={data.contactRelationship === option} onClick={() => setField('contactRelationship', option)}>{option}</button>
          ))}
        </div>
      </div>
    </MeEditLayout>
  );
}
