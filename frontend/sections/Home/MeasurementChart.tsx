'use client';

import type { ProgressRecord } from '../../lib/api';
import { dayTimeAxis, measurementAxis, recordedDateAxis } from '../../lib/measurementChart';
import type { ProgressPeriod } from '../../lib/progressDates';

const timeLabel = (timestamp: number) => new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const dateLabel = (timestamp: number, includeYear: boolean) => new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(includeYear ? { year: '2-digit' } : {}) });
const numberLabel = (value: number) => String(Number(value.toFixed(2)));

export default function MeasurementChart({ entries, label, unit, period, start, end, now }: { entries: ProgressRecord[]; label: string; unit: string; period: ProgressPeriod; start: number; end: number; now: Date }) {
  const points = entries.map(entry => ({ ...entry, time: new Date(entry.measuredAt ?? entry.date ?? '').getTime() })).filter(entry => Number.isFinite(entry.time) && Number.isFinite(entry.value));
  const axis = measurementAxis(points.map(point => point.value));
  if (!axis || !points.length) return null;
  const hours = period === 'day' ? dayTimeAxis(points.map(point => point.time), now) : null;
  const dates = hours ? null : recordedDateAxis(points.map(point => point.time));
  const chartStart = hours?.start ?? start, chartEnd = hours?.end ?? end;
  const x = (time: number) => dates ? dates.position(time) : Math.max(0, Math.min(100, (time - chartStart) / Math.max(1, chartEnd - chartStart) * 100));
  const y = (value: number) => (axis.high - value) / (axis.high - axis.low) * 100;
  const times = hours?.ticks ?? dates?.ticks ?? [];
  const includeYear = !hours && new Set(times.map(time => new Date(time).getFullYear())).size > 1;
  const width = Math.max(220, (times.length - 1) * (hours ? 68 : includeYear ? 88 : 72));
  const description = points.map(point => `${new Date(point.time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}: ${numberLabel(point.value)} ${unit}`).join('; ');

  return <div className="measurement-chart" role="img" aria-label={`${label} trend in ${unit}. ${description}`}>
    <div className="measurement-axis-unit">{unit}</div>
    <div className="measurement-chart-body">
      <div className="measurement-axis-y" aria-hidden="true">{axis.ticks.map(tick => <span key={tick} style={{ top: `${y(tick)}%` }}>{numberLabel(tick)}</span>)}</div>
      <div className="measurement-chart-scroll">
        <div className="measurement-chart-inner" style={{ minWidth: width }}>
          <div className="measurement-chart-plot">
            {axis.ticks.map(tick => <span className="measurement-gridline" key={tick} style={{ top: `${y(tick)}%` }}/>) }
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" points={points.map(point => `${x(point.time) * 10},${y(point.value) * 10}`).join(' ')}/>{points.map(point => <circle key={point._id} cx={x(point.time) * 10} cy={y(point.value) * 10} r="14" fill="currentColor"><title>{`${timeLabel(point.time)}: ${numberLabel(point.value)} ${unit}`}</title></circle>)}</svg>
          </div>
          <div className="measurement-axis-x" aria-hidden="true">{times.map((time, index) => <span key={time} style={{ left: `${x(time)}%`, transform: times.length === 1 ? 'translateX(-50%)' : index === 0 ? 'none' : index === times.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{hours ? timeLabel(time) : dateLabel(time, includeYear)}</span>)}</div>
        </div>
      </div>
    </div>
    {times.length > 4 && <small className="measurement-scroll-hint">Swipe to view all {hours ? 'hours' : 'recording dates'}</small>}
    {dates && dates.ticks.length > 1 && <small className="measurement-scroll-hint">Recording dates are evenly spaced.</small>}
  </div>;
}
