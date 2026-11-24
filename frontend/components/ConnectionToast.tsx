'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../sections/Home/icons';

export type ToastTone = 'offline' | 'connecting' | 'online' | 'sync';

const ICONS: Record<Exclude<ToastTone, 'connecting'>, string> = { offline: 'warning', online: 'check-circle', sync: 'user' };
const SWIPE_X = 72, SWIPE_UP = 36, LEAVE_MS = 180;

type Props = {
  tone: ToastTone;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void; busy?: boolean };
  dismissLabel?: string;
  onDismiss: () => void;
  autoHideMs?: number;
};

/** Top-of-screen connection status. Dismiss with the close button or by swiping sideways or up. */
export default function ConnectionToast({ tone, title, message, action, dismissLabel = 'Dismiss', onDismiss, autoHideMs }: Props) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<'left' | 'right' | 'up' | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const leave = (direction: 'left' | 'right' | 'up') => {
    if (leaving) return;
    setLeaving(direction);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => dismissRef.current(), reduced ? 0 : LEAVE_MS);
  };

  useEffect(() => {
    if (!autoHideMs) return;
    const timer = setTimeout(() => dismissRef.current(), autoHideMs);
    return () => clearTimeout(timer);
  }, [autoHideMs, title]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    start.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setDrag({ x: event.clientX - start.current.x, y: Math.min(0, event.clientY - start.current.y) });
  };
  const onPointerEnd = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (Math.abs(drag.x) > SWIPE_X) leave(drag.x > 0 ? 'right' : 'left');
    else if (drag.y < -SWIPE_UP) leave('up');
    else setDrag({ x: 0, y: 0 });
  };

  const offset = leaving === 'left' ? { x: -420, y: 0 } : leaving === 'right' ? { x: 420, y: 0 } : leaving === 'up' ? { x: 0, y: -160 } : drag;
  const fade = leaving ? 0 : Math.max(0.35, 1 - Math.abs(drag.x) / 240 - Math.abs(drag.y) / 120);
  return <div className={`pq-toast pq-toast-${tone}${dragging ? ' is-dragging' : ''}`} role="status" aria-live="polite"
    style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`, opacity: fade }}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
    <span className="pq-toast-icon" aria-hidden="true">{tone === 'connecting' ? <span className="pq-toast-spinner"/> : <Icon name={ICONS[tone]} size={18}/>}</span>
    <span className="pq-toast-copy"><strong>{title}</strong>{message && <small>{message}</small>}
      {action && <button type="button" className="pq-toast-action" onClick={action.onClick} disabled={action.busy}>{action.busy ? 'Checking…' : action.label}</button>}
    </span>
    <button type="button" className="pq-toast-close" aria-label={dismissLabel} onClick={() => leave('up')}><Icon name="close" size={18}/></button>
  </div>;
}
