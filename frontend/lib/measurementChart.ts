/** Calculate a readable axis that includes each recorded measurement. */
export function measurementAxis(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  const min = Math.min(...finite), max = Math.max(...finite);
  const raw = Math.max((max - min) / 4, 0.5);
  const power = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].find(value => value * power >= raw) ?? 10;
  const step = factor * power;
  let low = Math.floor(min / step) * step;
  let high = Math.ceil(max / step) * step;
  if (high === low) { low = Math.max(0, low - step); high += step; }
  const ticks: number[] = [];
  for (let value = high, i = 0; value >= low - step / 1000 && i < 20; value = high - ++i * step) ticks.push(Number(value.toFixed(6)));
  return { low, high, ticks };
}

/** Show the first recorded hour through the current hour, in local device time. */
export function dayTimeAxis(timestamps: number[], now: Date) {
  const first = new Date(Math.min(...timestamps));
  first.setMinutes(0, 0, 0);
  const start = first.getTime();
  const last = Math.max(now.getTime(), ...timestamps);
  const lastHour = new Date(last);
  lastHour.setMinutes(0, 0, 0);
  const end = Math.max(start + 3_600_000, lastHour.getTime() + (last > lastHour.getTime() ? 3_600_000 : 0));
  const ticks: number[] = [];
  for (let time = start; time <= end; time += 3_600_000) ticks.push(time);
  return { start, end, ticks };
}

/** One categorical tick per local recording date, in chronological order. */
export function recordedDateAxis(timestamps: number[]) {
  const byDate = new Map<string, number>();
  for (const timestamp of [...timestamps].sort((a, b) => a - b)) {
    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!byDate.has(key)) byDate.set(key, new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime());
  }
  const ticks = [...byDate.values()];
  const index = new Map([...byDate.keys()].map((key, i) => [key, i]));
  const position = (timestamp: number) => {
    const date = new Date(timestamp);
    const i = index.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`) ?? 0;
    return ticks.length === 1 ? 50 : i / (ticks.length - 1) * 100;
  };
  return { ticks, position };
}
