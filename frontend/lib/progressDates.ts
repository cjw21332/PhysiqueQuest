export type ProgressPeriod = 'day' | 'week' | 'month' | 'custom';

export function localDateString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
}

export function progressRange(period: Exclude<ProgressPeriod, 'custom'>, now: Date): { start: Date; end: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  const end = new Date(today);
  if (period === 'week') {
    start.setDate(start.getDate() - start.getDay());
    end.setDate(start.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    start.setDate(Math.min(today.getDate(), lastDay));
  }
  return { start, end };
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function validCustomRange(from: string, to: string, account: string, today: string): boolean {
  return Boolean(localDate(account) && localDate(today) && localDate(from) && localDate(to) && account <= today && from >= account && from <= to && to <= today);
}
