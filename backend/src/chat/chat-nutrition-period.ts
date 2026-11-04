export type NutritionPeriod = { start: string; end: string };

export function nutritionSelectedDate(question: string, today: string): string {
  const explicit = question.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (explicit) return explicit;
  const day = new Date(today + 'T00:00:00Z');
  const offset = (days: number) => new Date(day.getTime() + days * 86400_000).toISOString().slice(0, 10);
  if (/\bday before yesterday\b/.test(question)) return offset(-2);
  if (/\byesterday\b/.test(question)) return offset(-1);
  if (/\btomorrow\b/.test(question)) return offset(1);
  const ago = /\b(\d{1,3}) days? ago\b/.exec(question)?.[1];
  if (ago) return offset(-Number(ago));
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekday = /\b(last|on|next) (sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(question);
  if (weekday) {
    const difference = weekdays.indexOf(weekday[2]) - day.getUTCDay();
    if (weekday[1] === 'next') return offset((difference + 7) % 7 || 7);
    const past = (7 - difference) % 7;
    return offset(-(past || (weekday[1] === 'last' ? 7 : 0)));
  }
  return today;
}

/** Calendar periods are resolved in the account's activity date, with Monday-based weeks. */
export function nutritionPeriod(question: string, today: string): NutritionPeriod | undefined {
  const day = new Date(today + 'T00:00:00Z');
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const offset = (value: Date, days: number) => new Date(value.getTime() + days * 86400_000);
  const explicit = [...new Set(question.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [])];
  if (explicit.length === 2 && explicit.every(value => Number.isFinite(Date.parse(value)) && iso(new Date(value)) === value)) {
    const span = (Date.parse(explicit[1]) - Date.parse(explicit[0])) / 86400_000;
    if (span >= 0 && span <= 365) return { start: explicit[0], end: explicit[1] };
  }
  if (/\bthis month\b/.test(question)) return { start: today.slice(0, 8) + '01', end: today };
  if (/\bthis year\b/.test(question)) return { start: today.slice(0, 4) + '-01-01', end: today };
  if (/\blast year\b/.test(question)) { const year = day.getUTCFullYear() - 1; return { start: year + '-01-01', end: year + '-12-31' }; }
  if (/\blast month\b/.test(question)) {
    const previousEnd = offset(new Date(today.slice(0, 8) + '01T00:00:00Z'), -1);
    return { start: iso(previousEnd).slice(0, 8) + '01', end: iso(previousEnd) };
  }
  if (/\b(?:this|last) week\b/.test(question)) {
    const monday = offset(day, -((day.getUTCDay() + 6) % 7));
    return /\blast week\b/.test(question) ? { start: iso(offset(monday, -7)), end: iso(offset(monday, -1)) } : { start: iso(monday), end: today };
  }
  const count = /\b(?:last|past) (\d{1,3}) days?\b/.exec(question)?.[1];
  if (count && Number(count) > 0 && Number(count) <= 366) return { start: iso(offset(day, 1 - Number(count))), end: today };
  return undefined;
}
