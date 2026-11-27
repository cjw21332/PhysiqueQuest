/** Profile fields that decide a user's body index and fitness tier. Values are the strings the profile stores. */
export type BodyIndexProfile = { height?: string; heightInches?: string; heightUnit?: string; weight?: string; weightUnit?: string; activity?: string };
export type FitnessTier = 'starter' | 'building' | 'advanced';

/** Body mass index from the saved profile, or null when height or weight is missing or implausible. */
export function bodyMassIndex(profile: BodyIndexProfile | null | undefined): number | null {
  if (!profile) return null;
  const height = Number(profile.height), weight = Number(profile.weight);
  const cm = profile.heightUnit === 'ft & in.' ? (height * 12 + (Number(profile.heightInches) || 0)) * 2.54 : height;
  const kg = profile.weightUnit === 'lbs' ? weight * 0.45359237 : weight;
  if (!(cm >= 100 && cm <= 250 && kg >= 25 && kg <= 350)) return null;
  return kg / (cm / 100) ** 2;
}

/**
 * Starter: low activity, or BMI outside 18.5–29.9 (joint load or low reserves). Advanced: active or athlete with BMI under 27.
 * Everyone else (including an incomplete profile) is building.
 */
export function fitnessTier(profile: BodyIndexProfile | null | undefined): FitnessTier {
  const bmi = bodyMassIndex(profile);
  const activity = profile?.activity ?? '';
  if ((bmi !== null && (bmi < 18.5 || bmi >= 30)) || activity === 'Sedentary' || activity === 'Light') return 'starter';
  if ((activity === 'Active' || activity === 'Athlete') && (bmi === null || bmi < 27)) return 'advanced';
  return 'building';
}
