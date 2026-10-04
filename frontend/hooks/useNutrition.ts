'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type ScannedItem } from '../lib/api';
import type { FoodEntry, MealName } from '../sections/Scan/types';

type ServerNutrition = { meals: FoodEntry[]; water: { date: string; glasses: number }[] };
const today = () => new Date().toISOString().slice(0, 10);

function mapState(state: ServerNutrition) {
  return { meals: state.meals ?? [], water: state.water?.find(entry => entry.date === today())?.glasses ?? 0 };
}

export function useNutrition() {
  const [meals, setMeals] = useState<FoodEntry[]>([]);
  const [water, setWaterState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = mapState(await api.getNutrition());
      setMeals(next.meals); setWaterState(next.water);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load nutrition data.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const addMeal = useCallback(async (meal: Omit<FoodEntry, 'id' | 'date'>) => {
    const next = mapState(await api.addMeal(meal)); setMeals(next.meals); setWaterState(next.water);
  }, []);
  const addMealsFromScan = useCallback(async (payload: { items: ScannedItem[]; meal: MealName }) => {
    const next = mapState(await api.addMealsFromScan(payload)); setMeals(next.meals); setWaterState(next.water);
  }, []);
  const updateMeal = useCallback(async (id: string, meal: Partial<FoodEntry>) => {
    const next = mapState(await api.updateMeal(id, meal)); setMeals(next.meals); setWaterState(next.water);
  }, []);
  const deleteMeal = useCallback(async (id: string) => {
    const next = mapState(await api.deleteMeal(id)); setMeals(next.meals); setWaterState(next.water);
  }, []);
  const setWater = useCallback(async (glasses: number) => {
    const next = mapState(await api.setWater({ date: today(), glasses })); setMeals(next.meals); setWaterState(next.water);
  }, []);

  return { meals, water, loading, error, refresh, addMeal, addMealsFromScan, updateMeal, deleteMeal, setWater };
}
