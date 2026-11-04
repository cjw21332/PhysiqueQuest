export function nutrientTotal<T>(entries: readonly T[], read: (entry: T) => number | null | undefined) {
  let sum = 0;
  for (const entry of entries) {
    const value = read(entry);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    sum += value;
  }
  return sum;
}
export function nutrientLabel(value: number | null, unit: string) {
  return value === null ? 'Incomplete' : Math.round(value).toLocaleString() + ' ' + unit;
}
