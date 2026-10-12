export const TRAINING_DAYS = [
  { value: 'Monday', label: 'Mon', legacyId: 'M-0' },
  { value: 'Tuesday', label: 'Tue', legacyId: 'T-1' },
  { value: 'Wednesday', label: 'Wed', legacyId: 'W-2' },
  { value: 'Thursday', label: 'Thu', legacyId: 'T-3' },
  { value: 'Friday', label: 'Fri', legacyId: 'F-4' },
  { value: 'Saturday', label: 'Sat', legacyId: 'S-5' },
  { value: 'Sunday', label: 'Sun', legacyId: 'S-6' },
] as const;

const LEGACY_INITIALS: Record<string, string[]> = {
  m: ['Monday'],
  t: ['Tuesday', 'Thursday'],
  w: ['Wednesday'],
  f: ['Friday'],
  s: ['Saturday', 'Sunday'],
};

export function normalizeTrainingDays(days: readonly string[] = []): string[] {
  const selected = new Set<string>();
  const totals = new Map<string, number>();
  const occurrences = new Map<string, number>();

  for (const value of days) {
    const key = value.trim().toLowerCase();
    if (LEGACY_INITIALS[key]) totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  for (const value of days) {
    const key = value.trim().toLowerCase();
    const exact = TRAINING_DAYS.find(day =>
      day.value.toLowerCase() === key || day.legacyId.toLowerCase() === key
    );
    if (exact) {
      selected.add(exact.value);
      continue;
    }

    const matches = LEGACY_INITIALS[key];
    if (!matches) continue;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    selected.add(matches[Math.min(occurrence, (totals.get(key) ?? 1) - 1)]);
  }

  return TRAINING_DAYS.filter(day => selected.has(day.value)).map(day => day.value);
}

export function formatTrainingDays(days: readonly string[] = []): string {
  const selected = new Set(normalizeTrainingDays(days));
  return TRAINING_DAYS.filter(day => selected.has(day.value)).map(day => day.label).join(', ');
}
