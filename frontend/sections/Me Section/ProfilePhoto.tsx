'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Home/icons';
import { api } from '../../lib/api';
import './profile-photo.css';

export default function ProfilePhoto({ photo, onClose, onSaved }: { photo?: string; onClose: () => void; onSaved: (profile: { photo?: string }) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(photo || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const select = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPEG, PNG or WebP image up to 5 MB.'); return; }
    setError(''); setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext('2d'); if (!context || !side) throw new Error();
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
      setPreview(canvas.toDataURL('image/jpeg', .85));
    } catch { setError('We couldn’t open this image. Please choose another.'); }
    finally { URL.revokeObjectURL(url); setBusy(false); }
  };
  const save = async () => { setBusy(true); setError(''); try { onSaved(await api.saveProfilePhoto(preview || null)); onClose(); } catch { setError('Couldn’t save your photo. Please try again.'); } finally { setBusy(false); } };
  return <dialog ref={dialog} className="profile-photo-dialog" aria-labelledby="photo-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><h2 id="photo-title">Profile picture</h2><p>Choose a photo for your profile.</p></div><button type="button" aria-label="Close" disabled={busy} onClick={onClose}><Icon name="close" size={20}/></button></header>
    <div className="profile-photo-preview">{preview ? <img src={preview} alt="Profile photo preview" /> : <Icon name="user" size={48}/>}</div>
    <input ref={library} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={event => { void select(event.target.files?.[0]); event.target.value = ''; }}/>
    <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="visually-hidden" onChange={event => { void select(event.target.files?.[0]); event.target.value = ''; }}/>
    <button type="button" className="profile-photo-option" disabled={busy} onClick={() => library.current?.click()}><Icon name="image" size={18}/>Choose from library</button>
    <button type="button" className="profile-photo-option" disabled={busy} onClick={() => camera.current?.click()}><Icon name="camera" size={18}/>Take a photo</button>
    <button type="button" className="profile-photo-option remove" disabled={busy || !preview} onClick={() => setPreview('')}><Icon name="trash" size={18}/>Remove photo</button>
    <p className="profile-photo-note">JPEG, PNG or WebP · up to 5 MB. Photos are cropped to a square.</p>
    {error && <p role="alert" className="profile-photo-error">{error}</p>}
    <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" disabled={busy || preview === (photo || '')} onClick={() => void save()}>{busy ? 'Please wait…' : 'Save photo'}</button></footer>
  </dialog>;
}
