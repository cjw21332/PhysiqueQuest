type SavedMeal = { id?: string; date?: string; scanSavedAt?: Date | string; scanGroupId?: string };
type ScanReceipt = { key: string; mealIds: string[] };

/** Count a confirmed scan save once, even when it contains multiple foods. */
export function savedScanMealDates(meals: SavedMeal[], receipts: ScanReceipt[] = []): string[] {
  const groupsByMeal = new Map<string, string>();
  for (const receipt of receipts) {
    for (const id of receipt.mealIds ?? []) groupsByMeal.set(String(id), receipt.key);
  }
  const dates = new Map<string, string>();
  for (const meal of meals) {
    if (!meal.date || !meal.scanSavedAt) continue;
    const savedAt = new Date(meal.scanSavedAt).getTime();
    const group = meal.scanGroupId || (meal.id && groupsByMeal.get(String(meal.id))) ||
      (Number.isFinite(savedAt) ? 'legacy:' + savedAt : undefined);
    if (group) dates.set(group, meal.date);
  }
  return [...dates.values()];
}
