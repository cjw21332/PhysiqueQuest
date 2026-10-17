export function convertMeasurement(value: number, from: string, to: string) {
  const factor: Record<string, number> = { kg: 1, lb: 0.45359237, lbs: 0.45359237, cm: 1, in: 2.54, inch: 2.54 };
  return value * (factor[from] ?? 1) / (factor[to] ?? 1);
}
