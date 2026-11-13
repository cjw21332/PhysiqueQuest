import { api } from './api';
import type { Profile } from '../sections/Home/types';

/** Update related records after the profile has been saved. */
export async function recordWeightChange(profile: Profile) {
  const amount = Number(profile.weight);
  const unit = profile.weightUnit === 'lbs' || profile.weightUnit === 'lb' ? 'lb' : 'kg';
  await api.addProgress({ metric: 'weight', value: amount, unit, measuredAt: new Date().toISOString() });
  return updateNutritionForProfile(profile);
}

/** Recalculate the saved calorie target from current measurements and an optional new goal. */
export async function updateNutritionForProfile(profile: Profile, useProfileGoal = false) {
  const nutrition = await api.getNutrition(true);
  const goals: Record<string, string> = { 'Weight loss': 'Weight Loss', 'Build muscle': 'Hypertrophy', Strength: 'Maintenance', Endurance: 'Maintenance', 'General fitness': 'Maintenance' };
  const plan = nutrition?.dietaryPlan ?? { goal: goals[profile.goal] || 'Maintenance', protein: 30, carbs: 45, fat: 25 };
  const goal = useProfileGoal ? goals[profile.goal] : plan.goal;
  if (!goal) return 'Profile saved. Choose a supported goal to update your nutrition target.';
  const age = Number(profile.age);
  const amount = Number(profile.weight);
  const weightKg = profile.weightUnit === 'lbs' || profile.weightUnit === 'lb' ? amount * 0.45359237 : amount;
  const heightCm = profile.heightUnit === 'ft & in.' ? (Number(profile.height) * 12 + Number(profile.heightInches || 0)) * 2.54 : Number(profile.height);
  if (age < 18 || !Number.isFinite(age) || !Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(heightCm) || heightCm <= 0 || !['Male', 'Female'].includes(profile.gender || '')) return 'Profile saved. Your calorie target was not changed because the adult estimate needs weight, age, height and sex-based inputs.';
  const activities: Record<string, number> = { Sedentary: 1.2, Light: 1.375, Moderate: 1.55, Active: 1.725, Athlete: 1.9 };
  const offsets: Record<string, number> = { 'Clean Bulk': 300, 'Weight Loss': -450, Maintenance: 0, Hypertrophy: 500 };
  const activity = plan.activity || profile.activity || 'Moderate';
  const estimated = (10 * weightKg + 6.25 * heightCm - 5 * age + (profile.gender === 'Male' ? 5 : -161)) * (activities[activity] || 1.55) + (offsets[goal] ?? 0);
  const calories = Math.round(estimated / 10) * 10;
  if (!Number.isFinite(calories) || calories < 1000 || calories > 6000) return 'Weight saved. Review your calorie target in your dietary plan.';
  await api.setDietaryPlan({ goal, calories, protein: plan.protein, carbs: plan.carbs, fat: plan.fat, ...(plan.activity ? { activity: plan.activity } : {}), ...(plan.startedAt ? { startedAt: plan.startedAt } : {}) });
  return `Profile saved. Estimated daily target updated to ${calories} kcal.`;
}
