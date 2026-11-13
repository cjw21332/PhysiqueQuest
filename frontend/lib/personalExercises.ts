import { getCurrentUser } from './auth';
import { getApiBaseUrl } from './api';

export type PersonalExercise = { _id: string; name: string; targetMuscle: string; equipment: string; pose: 'missing' };
export const primaryEquipment = ['Bodyweight', 'Dumbbells', 'Barbell', 'Cable', 'Machine', 'Kettlebell', 'Resistance bands'];
export const muscleGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full body'];

function storageKey() {
  const user = getCurrentUser();
  if (!user?.id) throw new Error('Sign in to manage your exercises.');
  return `physiquequest-personal-exercises:${encodeURIComponent(getApiBaseUrl())}:${encodeURIComponent(user.id)}`;
}
export function readPersonalExercises(): PersonalExercise[] {
  const raw = localStorage.getItem(storageKey());
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Your saved exercises could not be read.');
  return value.filter((item): item is PersonalExercise => item && typeof item._id === 'string' && item._id.startsWith('personal-') && typeof item.name === 'string' && typeof item.targetMuscle === 'string' && typeof item.equipment === 'string' && item.pose === 'missing');
}
export function savePersonalExercises(items: PersonalExercise[]) {
  localStorage.setItem(storageKey(), JSON.stringify(items));
  window.dispatchEvent(new Event('physiquequest-personal-exercises-updated'));
}
