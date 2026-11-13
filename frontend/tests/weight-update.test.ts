import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ addProgress: vi.fn(), getNutrition: vi.fn(), setDietaryPlan: vi.fn() }));
vi.mock('../lib/api', () => ({ api: mocks }));
import { recordWeightChange, updateNutritionForProfile } from '../lib/weightUpdate';
const profile = { name: 'A', email: '', goal: 'Weight loss', duration: '', targetWeight: '', weightUnit: 'lbs', weight: '154.3236', height: '170', heightUnit: 'cm' as const, age: '30', gender: 'Female', activity: 'Moderate' };
beforeEach(() => { vi.clearAllMocks(); mocks.addProgress.mockResolvedValue({}); mocks.getNutrition.mockResolvedValue({ dietaryPlan: { goal: 'Weight Loss', calories: 2000, protein: 30, carbs: 45, fat: 25 } }); mocks.setDietaryPlan.mockResolvedValue({}); });
it('records weight and recalculates an adult plan while preserving macros', async () => {
  await recordWeightChange(profile);
  expect(mocks.addProgress).toHaveBeenCalledWith(expect.objectContaining({ value: 154.3236, unit: 'lb' }));
  expect(mocks.setDietaryPlan).toHaveBeenCalledWith(expect.objectContaining({ goal: 'Weight Loss', calories: 1800, protein: 30, carbs: 45, fat: 25 }));
});
it('does not calculate adult calorie estimates for minors', async () => {
  const message = await recordWeightChange({ ...profile, age: '16' });
  expect(message).toContain('not changed');
  expect(mocks.setDietaryPlan).not.toHaveBeenCalled();
});
it('uses the profile goal to update the calorie target and retains the chosen macro percentages', async () => {
  await updateNutritionForProfile({ ...profile, goal: 'Build muscle' }, true);
  expect(mocks.setDietaryPlan).toHaveBeenCalledWith(expect.objectContaining({ goal: 'Hypertrophy', calories: 2750, protein: 30, carbs: 45, fat: 25 }));
});
it('uses maintenance for general fitness and avoids calculating with missing weight', async () => {
  await updateNutritionForProfile({ ...profile, goal: 'General fitness' }, true);
  expect(mocks.setDietaryPlan).toHaveBeenCalledWith(expect.objectContaining({ goal: 'Maintenance', calories: 2250 }));
  mocks.setDietaryPlan.mockClear();
  await updateNutritionForProfile({ ...profile, weight: '' }, true);
  expect(mocks.setDietaryPlan).not.toHaveBeenCalled();
});
