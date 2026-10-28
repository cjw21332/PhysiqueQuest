'use client';

import { useCallback } from 'react';
import { api, type ScannedItem } from '../lib/api';
import type { FoodEntry, MealName } from '../sections/Scan/types';
import { formatLocalDate } from '../lib/localDate.mjs';
import { useAppResource } from './useAppResource';

export type DietaryPlan = { goal: string; calories: number; protein: number; carbs: number; fat: number; activity?: string; startedAt?: string };
type ServerNutrition = { meals: FoodEntry[]; water: { date: string; glasses: number }[]; dietaryPlan?: DietaryPlan | null };
const load = (force?: boolean) => api.getNutrition(force);

export function useNutrition() {
  const { data, loading, error, refresh } = useAppResource<ServerNutrition>('nutrition', load);
  const addMeal = useCallback(async (meal: Omit<FoodEntry, 'id' | 'date'>) => {
    await api.addMeal({ ...meal, date: formatLocalDate() });
  }, []);
  const addMealsFromScan = useCallback(async (payload: { items: ScannedItem[]; meal: MealName }) => {
    await api.addMealsFromScan({ ...payload, date: formatLocalDate(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) });
  }, []);
  const updateMeal = useCallback(async (id: string, meal: Partial<FoodEntry>) => { await api.updateMeal(id, meal); }, []);
  const deleteMeal = useCallback(async (id: string) => { await api.deleteMeal(id); }, []);
  const setWater = useCallback(async (glasses: number) => { await api.setWater({ date: formatLocalDate(), glasses }); }, []);
  return { dietaryPlan: data?.dietaryPlan ?? null, meals: data?.meals ?? [], water: data?.water?.find(entry => entry.date === formatLocalDate())?.glasses ?? 0, loading, error, refresh, addMeal, addMealsFromScan, updateMeal, deleteMeal, setWater };
}
