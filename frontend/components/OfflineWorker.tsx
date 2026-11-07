'use client';
import { useEffect } from 'react';
export default function OfflineWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) void navigator.serviceWorker.register('/exercise-worker.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}
