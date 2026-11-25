'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getApiBaseUrl } from '../lib/api';
import { session } from '../lib/session';
import { DATA_CHANGE_EVENT } from '../lib/dataChanges.mjs';
import type { ActivityBadge } from '../hooks/useActivity';
import { buildBadgeCollection } from '../sections/Quests Section/badgeProgress';
import { BadgeIcon } from '../sections/Quests Section/QuestSection';
import { BADGE_CATEGORIES, TIER_LABEL, badgeMeta } from '../sections/Quests Section/badgeCatalog';
import { Icon } from '../sections/Home/icons';
import OutcomeDialog from './OutcomeDialog';
import './badgeCelebrations.css';

type Snapshot = { known: Record<string, boolean>; announced: string[]; pending: string[] };
const emptySnapshot = (): Snapshot => ({ known: {}, announced: [], pending: [] });
const image = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Could not load the badge image.')); img.src = src; });

export default function BadgeCelebrations() {
  const [queue, setQueue] = useState<ActivityBadge[]>([]);
  const [replay, setReplay] = useState<ActivityBadge | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ kind: 'success' | 'info'; title: string; message: string } | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const ownerRef = useRef('');
  const sequence = useRef(0);

  const check = useCallback(async () => {
    const owner = session.current(getApiBaseUrl());
    if (!owner?.id || !owner.token || document.visibilityState !== 'visible') return;
    const scope = `${getApiBaseUrl()}:${owner.id}`;
    const key = `pq-badge-celebrations:${scope}`;
    const generation = ++sequence.current;
    const [activity, profile, ranking, workouts, summary, nutrition] = await Promise.allSettled([api.getActivity(true), api.getProfile(), api.getLeaderboard('all'), api.getAllWorkouts(), api.getWorkoutSummary(), api.getNutrition()]);
    if (generation !== sequence.current || session.current(getApiBaseUrl())?.id !== owner.id || activity.status !== 'fulfilled' || profile.status !== 'fulfilled') return;
    const record = activity.value;
    const rankingValue = ranking.status === 'fulfilled' && ranking.value?.self && Number.isFinite(ranking.value.self.rank) && Number.isFinite(ranking.value.self.points) ? ranking.value : null;
    const summaryValue = summary.status === 'fulfilled' && Array.isArray(summary.value?.trainingDates) && Array.isArray(summary.value?.personalRecords) ? summary.value : null;
    const nutritionValue = nutrition.status === 'fulfilled' && Array.isArray(nutrition.value?.meals) && Array.isArray(nutrition.value?.water) ? nutrition.value : null;
    const badges = buildBadgeCollection({ activity: record.state, saved: record.badges ?? [], profile: profile.value, ranking: rankingValue, workouts: workouts.status === 'fulfilled' && Array.isArray(workouts.value) ? workouts.value : null, summary: summaryValue, nutrition: nutritionValue });
    let snapshot = snapshotRef.current;
    if (ownerRef.current !== scope || !snapshot) {
      ownerRef.current = scope;
      try { const stored = JSON.parse(localStorage.getItem(key) || 'null'); snapshot = stored && typeof stored.known === 'object' && Array.isArray(stored.announced) && Array.isArray(stored.pending) ? stored : emptySnapshot(); } catch { snapshot = emptySnapshot(); }
    }
    const announced = new Set(snapshot!.announced), pending = new Set(snapshot!.pending);
    for (const badge of badges) {
      if (badge.available === false) continue;
      const wasKnown = Object.hasOwn(snapshot!.known, badge.id);
      if (wasKnown && !snapshot!.known[badge.id] && badge.earned && !announced.has(badge.id)) pending.add(badge.id);
      snapshot!.known[badge.id] = badge.earned;
    }
    snapshot!.pending = [...pending];
    snapshotRef.current = snapshot;
    try { localStorage.setItem(key, JSON.stringify(snapshot)); } catch { /* Keep this session's queue in memory. */ }
    setQueue(snapshot!.pending.map(id => badges.find(badge => badge.id === id && badge.earned && badge.available !== false)).filter((badge): badge is ActivityBadge => Boolean(badge)));
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { void check(); }, 300); };
    refresh();
    window.addEventListener(DATA_CHANGE_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = setInterval(refresh, 60000);
    return () => { sequence.current++; clearTimeout(timer); clearInterval(interval); window.removeEventListener(DATA_CHANGE_EVENT, refresh); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [check]);

  useEffect(() => {
    const open = (event: Event) => {
      const requested = (event as CustomEvent<ActivityBadge>).detail;
      if (requested?.earned && requested.available !== false && typeof requested.id === 'string') { setError(''); setOutcome(null); setReplay(requested); }
    };
    window.addEventListener('physiquequest:show-badge-card', open);
    return () => window.removeEventListener('physiquequest:show-badge-card', open);
  }, []);

  const badge = replay ?? queue[0];
  const dismiss = () => {
    if (replay) { setReplay(null); setError(''); setOutcome(null); return; }
    if (!badge || !snapshotRef.current) return;
    const snapshot = snapshotRef.current;
    snapshot.pending = snapshot.pending.filter(id => id !== badge.id);
    if (!snapshot.announced.includes(badge.id)) snapshot.announced.push(badge.id);
    try { localStorage.setItem(`pq-badge-celebrations:${ownerRef.current}`, JSON.stringify(snapshot)); } catch {}
    setQueue(current => current.slice(1)); setError(''); setOutcome(null);
  };
  useEffect(() => {
    if (!badge) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handler = (event: KeyboardEvent) => {
      if (outcome) return;
      if (event.key === 'Escape') { dismiss(); return; }
      if (event.key !== 'Tab') return;
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  // Re-establish focus only when a different achievement opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge?.id, outcome]);

  const makeCard = async () => {
    if (!badge) throw new Error('No badge selected.');
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Could not create the image.');
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350); gradient.addColorStop(0, '#092419'); gradient.addColorStop(.48, '#0b1519'); gradient.addColorStop(1, '#111b27'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = '#153b2b'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1080, 0); ctx.lineTo(1080, 20); ctx.lineTo(0, 210); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1bdd7c'; ctx.fillRect(84, 90, 8, 50);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ecfff3'; ctx.font = 'bold 32px sans-serif'; ctx.fillText('PHYSIQUEQUEST', 112, 126);
    ctx.textAlign = 'right'; ctx.fillStyle = '#a9cfb9'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('ACHIEVEMENT  /  UNLOCKED', 996, 126);
    ctx.strokeStyle = '#326249'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(84, 175); ctx.lineTo(996, 175); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#73e8a6'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('YOUR HARD WORK SHOWS', 540, 244);
    // The crest is one self-contained SVG, so it renders on the card at any size.
    const crest = badgeRef.current?.querySelector<SVGSVGElement>('svg.badge-crest');
    if (crest) {
      const clone = crest.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', '560'); clone.setAttribute('height', '560');
      const art = await image(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`);
      ctx.drawImage(art, 260, 275, 560, 560);
    }
    ctx.fillStyle = '#83eeb0'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('BADGE EARNED', 540, 895);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 68px sans-serif';
    const words = badge.title.split(/\s+/); let line = '', y = 976;
    for (const word of words) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > 850 && line) { ctx.fillText(line, 540, y); y += 82; line = word; } else line = next; }
    if (line) ctx.fillText(line, 540, y);
    ctx.fillStyle = '#b9cfc4'; ctx.font = '30px sans-serif'; ctx.fillText('Every rep. Every step. Earned.', 540, y + 60);
    ctx.strokeStyle = '#326249'; ctx.beginPath(); ctx.moveTo(84, 1190); ctx.lineTo(996, 1190); ctx.stroke();
    const logo = await image('/physiquequest-icon.png'); ctx.save(); ctx.beginPath(); ctx.arc(126, 1262, 40, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(logo, 86, 1222, 80, 80); ctx.restore();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('PHYSIQUEQUEST', 184, 1257); ctx.fillStyle = '#a2bcb0'; ctx.font = '24px sans-serif'; ctx.fillText('BUILD YOUR LEGACY', 184, 1292);
    ctx.textAlign = 'right'; ctx.fillStyle = '#7fe2a5'; ctx.font = 'bold 25px sans-serif'; ctx.fillText('KEEP GOING  /  PQ', 996, 1274);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the image.')), 'image/png'));
  };
  const exportCard = async (action: 'share' | 'save') => {
    setBusy(true); setError(''); setOutcome(null);
    try {
      const blob = await makeCard();
      const file = new File([blob], `PhysiqueQuest-${badge!.id}.png`, { type: 'image/png' });
      if (window.ReactNativeWebView) {
        const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the image.')); reader.onerror = () => reject(new Error('Could not read the image.')); reader.readAsDataURL(blob); });
        const requestId = `badge-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => { window.removeEventListener('physiquequest:badge-export', handler); reject(new Error('The device did not respond. Please try again.')); }, 20000);
          const handler = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.requestId !== requestId) return; clearTimeout(timeout); window.removeEventListener('physiquequest:badge-export', handler); if (detail.error) reject(new Error(detail.error)); else resolve(); };
          window.addEventListener('physiquequest:badge-export', handler);
          window.ReactNativeWebView!.postMessage(JSON.stringify({ type: 'badge-export', requestId, image: encoded, name: file.name, intent: action }));
        });
        setOutcome(action === 'save' ? { kind: 'success', title: 'Image saved', message: 'Your achievement is saved in Pictures / PhysiqueQuest.' } : { kind: 'info', title: 'Ready to share', message: 'Choose an app to share your achievement. A copy was saved to Pictures / PhysiqueQuest.' });
      } else if (action === 'share') {
        if (!navigator.share || !navigator.canShare?.({ files: [file] })) throw new Error('Image sharing is unavailable on this device. Save the image and share it from your gallery.');
        await navigator.share({ files: [file], title: 'PhysiqueQuest achievement' });
        setOutcome({ kind: 'success', title: 'Ready to celebrate', message: 'Your achievement was handed to the sharing app.' });
      } else {
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); setOutcome({ kind: 'info', title: 'Download started', message: 'Your achievement image is downloading to your device.' });
      }
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Could not create the image. Please try again.'); }
    finally { setBusy(false); }
  };
  if (!badge) return null;
  const meta = badgeMeta(badge.id);
  const category = BADGE_CATEGORIES.find(item => item.id === meta.category);
  return <div className="badge-celebration-backdrop" style={{ '--bc-hue': category?.hue ?? '#22c55e' } as React.CSSProperties}><section ref={dialogRef} className={`badge-celebration tier-${meta.tier}`} role="dialog" aria-modal="true" aria-labelledby="badge-celebration-title" aria-describedby="badge-celebration-description">
    <button className="badge-celebration-close" type="button" aria-label="Close achievement" onClick={dismiss}><Icon name="close" size={20}/></button>
    <div className="badge-celebration-ribbon"><Icon name="star" size={14}/> Achievement unlocked</div>
    <div className="badge-celebration-stage">
      <span className="badge-celebration-rays" aria-hidden="true"/>
      <span className="badge-celebration-halo" aria-hidden="true"/>
      {[0, 1, 2, 3, 4, 5].map(index => <i key={index} className={`badge-celebration-spark s${index}`} aria-hidden="true"/>)}
      <div className="badge-celebration-art" ref={badgeRef}><BadgeIcon badge={badge} size={184}/></div>
    </div>
    <div className="badge-celebration-tags"><span>{category?.name ?? 'Achievement'}</span><span className={`bc-tier bc-tier-${meta.tier}`}>{TIER_LABEL[meta.tier]}</span></div>
    <h2 id="badge-celebration-title">{badge.title}</h2>
    <p id="badge-celebration-description">{badge.description || 'Your hard work is paying off.'}</p>
    {!replay && queue.length > 1 && <p className="badge-celebration-queue">{queue.length - 1} more {queue.length === 2 ? 'badge' : 'badges'} to celebrate</p>}
    {error && <p className="badge-celebration-error" role="alert">{error}</p>}
    <button type="button" className="badge-celebration-share" disabled={busy} onClick={() => void exportCard('share')}><Icon name="share" size={19}/> {busy ? 'Preparing…' : 'Share this crest'}</button>
    <div className="badge-celebration-actions"><button type="button" disabled={busy} onClick={() => void exportCard('save')}><Icon name="download" size={17}/> Save image</button><button type="button" onClick={dismiss}>{!replay && queue.length > 1 ? 'Next badge' : 'Continue'}</button></div>
    <div className="badge-celebration-brand"><img src="/physiquequest-icon.png" alt="" width={22} height={22}/><span>PHYSIQUEQUEST</span></div>
  </section>{outcome && <OutcomeDialog kind={outcome.kind} title={outcome.title} message={outcome.message} actionLabel="Got it" onClose={() => setOutcome(null)}/>}</div>;
}
