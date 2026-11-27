'use client';
import { useEffect } from 'react';

const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Marks <html data-keyboard> while the user navigates by keyboard, so taps never leave a focus ring (see globals.css). */
export default function InputModality() {
  useEffect(() => {
    const root = document.documentElement;
    const keyboard = (event: KeyboardEvent) => { if (NAV_KEYS.has(event.key)) root.setAttribute('data-keyboard', ''); };
    const pointer = () => root.removeAttribute('data-keyboard');
    window.addEventListener('keydown', keyboard, true);
    window.addEventListener('pointerdown', pointer, true);
    return () => { window.removeEventListener('keydown', keyboard, true); window.removeEventListener('pointerdown', pointer, true); };
  }, []);
  return null;
}
