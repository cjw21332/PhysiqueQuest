export function mealMissionGoal(day: string, history: Map<string, number>) {
  const previous = new Date(day + 'T12:00:00Z');
  if (!Number.isFinite(previous.getTime())) return 3;
  previous.setUTCDate(previous.getUTCDate() - 1);
  const count = history.get(previous.toISOString().slice(0, 10));
  return count === 1 ? 2 : 3;
}

export function mealMissionPoints(count: number, target: number) {
  if (count >= 3) return 60;
  return count >= target ? target * 20 : 0;
}
