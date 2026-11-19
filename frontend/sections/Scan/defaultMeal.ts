import type { MealName } from './types';

export function defaultMeal(now = new Date()): MealName {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes >= 240 && minutes < 630) return 'Breakfast';
  if (minutes >= 630 && minutes < 900) return 'Lunch';
  if (minutes >= 900 && minutes < 1050) return 'Snack';
  return 'Dinner';
}
