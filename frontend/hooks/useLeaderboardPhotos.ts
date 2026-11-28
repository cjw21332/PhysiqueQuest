'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Photos are large, so they stay in memory for this app session and never go into the device cache.
const cache = new Map<string, string | null>();

/** Profile photos for leaderboard rows; returns a lookup that gives undefined until a photo is known. */
export function useLeaderboardPhotos(ids: string[]) {
  const [, setVersion] = useState(0);
  const key = [...new Set(ids.filter(Boolean))].sort().join(',');
  useEffect(() => {
    const missing = key ? key.split(',').filter(id => !cache.has(id)) : [];
    if (!missing.length) return;
    let active = true;
    for (const id of missing) cache.set(id, null);
    const groups = Array.from({ length: Math.ceil(missing.length / 50) }, (_, index) => missing.slice(index * 50, index * 50 + 50));
    void Promise.all(groups.map(group => api.getLeaderboardPhotos(group)
      .then(result => { for (const [id, photo] of Object.entries(result.photos ?? {})) if (group.includes(id)) cache.set(id, photo); })
      // Offline or failed: forget the ids so the next visit tries again; initials show meanwhile.
      .catch(() => { for (const id of group) cache.delete(id); })))
      .then(() => { if (active) setVersion(value => value + 1); });
    return () => { active = false; };
  }, [key]);
  return (id: string) => cache.get(id) ?? undefined;
}
