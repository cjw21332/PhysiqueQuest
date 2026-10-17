'use client';
import { useSettings } from './useSettings';
import { nutritionTargets } from '../sections/Scan/types';
export function useNutritionTargets() { const { settings } = useSettings(); return settings.nutritionTargets ?? nutritionTargets; }
