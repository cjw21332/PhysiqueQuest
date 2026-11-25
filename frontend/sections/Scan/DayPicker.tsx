'use client';
import { Icon } from '../Home/icons';
import { formatLocalDate } from '../../lib/localDate.mjs';
import './day-picker.css';

const DAY = 86400000;
/** Matches the server: meals and water can be back-filled up to 30 days. */
export const BACKFILL_DAYS = 30;
const parse = (date: string) => new Date(`${date}T12:00:00`);
export const shiftDay = (date: string, days: number) => formatLocalDate(new Date(parse(date).getTime() + days * DAY));
const label = (date: string, today: string) => date === today ? 'Today' : date === shiftDay(today, -1) ? 'Yesterday' : parse(date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

/** Day-by-day navigation for the food log: arrows step a day, the week strip jumps, future days stay locked. */
export default function DayPicker({ day, onDay, loggedDays }: { day: string; onDay: (day: string) => void; loggedDays: Set<string> }) {
  const today = formatLocalDate();
  const oldest = shiftDay(today, -BACKFILL_DAYS);
  const weekStart = shiftDay(day, -((parse(day).getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));
  return <section className="scan-day-picker" aria-label="Choose the day to log">
    <div className="scan-day-head">
      <button type="button" aria-label="Previous day" disabled={day <= oldest} onClick={() => onDay(shiftDay(day, -1))}><Icon name="chevron-left" size={20}/></button>
      <div aria-live="polite"><strong>{label(day, today)}</strong><small>{day === today ? parse(day).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : 'Logging for a past day'}</small></div>
      <button type="button" aria-label="Next day" disabled={day >= today} onClick={() => onDay(shiftDay(day, 1))}><Icon name="chevron-right" size={20}/></button>
    </div>
    <div className="scan-day-week" role="group" aria-label="This week">
      {week.map(date => {
        const locked = date > today || date < oldest;
        return <button type="button" key={date} disabled={locked} aria-pressed={date === day} className={`${date === day ? 'active' : ''} ${date === today ? 'today' : ''}`} onClick={() => onDay(date)} aria-label={`${parse(date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}${loggedDays.has(date) ? ', meals logged' : ''}`}>
          <small>{parse(date).toLocaleDateString([], { weekday: 'short' }).slice(0, 3)}</small>
          <b>{parse(date).getDate()}</b>
          <i aria-hidden="true" className={loggedDays.has(date) ? 'logged' : ''}/>
        </button>;
      })}
    </div>
    {day !== today && <button type="button" className="scan-day-today" onClick={() => onDay(today)}><Icon name="calendar" size={15}/> Back to today</button>}
  </section>;
}
