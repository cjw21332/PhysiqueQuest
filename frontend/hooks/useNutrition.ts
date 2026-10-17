'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ScannedItem } from '../lib/api';
import type { FoodEntry, MealName } from '../sections/Scan/types';
import { formatLocalDate } from '../lib/localDate.mjs';
import { accountScope, notifyDataChanged } from './useApiResource';

type ServerNutrition = { meals: FoodEntry[]; water: { date: string; glasses: number }[] };
type NutritionSnapshot = { meals: FoodEntry[]; water: number };
const NUTRITION_UPDATED_EVENT = 'physiquequest:nutrition-updated';
const today = () => formatLocalDate();

function mapState(state: ServerNutrition) {
  return { meals: state.meals ?? [], water: state.water?.find(entry => entry.date === today())?.glasses ?? 0 };
}

export function useNutrition() {
  const [meals, setMeals] = useState<FoodEntry[]>([]);
  const [water, setWaterState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const revision = useRef(0);
  const owner = useRef(accountScope());

  const applyState = useCallback((next: NutritionSnapshot) => {
    if (accountScope() !== owner.current) return;
    setMeals(next.meals);
    setWaterState(next.water);
    setError('');
    setLoading(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NUTRITION_UPDATED_EVENT, { detail: { ...next, accountId: owner.current } }));
    }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    setLoading(true);
    setError('');
    const requestedRevision = revision.current;
    const request = (async () => {
      try {
        const next = mapState(await api.getNutrition());
        if (revision.current === requestedRevision) {
          applyState(next);
        }
      } catch (err) {
        if (revision.current === requestedRevision) {
          setError(err instanceof Error ? err.message : 'Could not load nutrition data.');
        }
      } finally {
        if (revision.current === requestedRevision) setLoading(false);
      }
    })();
    refreshInFlight.current = request;
    try { await request; }
    finally { if (refreshInFlight.current === request) refreshInFlight.current = null; }
  }, [applyState]);

  useEffect(() => {
    void refresh();
    const onNutritionUpdated = (event: Event) => {
      const snapshot = (event as CustomEvent<NutritionSnapshot & { accountId: string }>).detail;
      if (!snapshot || snapshot.accountId !== owner.current || accountScope() !== owner.current) return;
      revision.current += 1;
      setMeals(snapshot.meals);
      setWaterState(snapshot.water);
      setError('');
      setLoading(false);
    };
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const clear = () => { revision.current += 1; setMeals([]); setWaterState(0); setLoading(false); };
    window.addEventListener(NUTRITION_UPDATED_EVENT, onNutritionUpdated);
    window.addEventListener('focus', refreshWhenActive);
    window.addEventListener('pageshow', refreshWhenActive);
    window.addEventListener('physiquequest:session-cleared', clear);
    return () => {
      window.removeEventListener(NUTRITION_UPDATED_EVENT, onNutritionUpdated);
      window.removeEventListener('focus', refreshWhenActive);
      window.removeEventListener('pageshow', refreshWhenActive);
      window.removeEventListener('physiquequest:session-cleared', clear);
    };
  }, [refresh]);

  const addMeal = useCallback(async (meal: Omit<FoodEntry, 'id' | 'date'>) => {
    const response = await api.addMeal({ ...meal, date: today() });
    revision.current += 1;
    const next = mapState(response);
    applyState(next);
    notifyDataChanged('activity', 'leaderboard');
  }, [applyState]);
  const addMealsFromScan = useCallback(async (payload: { items: ScannedItem[]; meal: MealName }) => {
    const response = await api.addMealsFromScan({ ...payload, date: today(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) });
    revision.current += 1;
    const next = mapState(response);
    applyState(next);
    notifyDataChanged('activity', 'leaderboard');
  }, [applyState]);
  const updateMeal = useCallback(async (id: string, meal: Partial<FoodEntry>) => {
    const response = await api.updateMeal(id, meal);
    revision.current += 1;
    const next = mapState(response);
    applyState(next);
    notifyDataChanged('activity', 'leaderboard');
  }, [applyState]);
  const deleteMeal = useCallback(async (id: string) => {
    const response = await api.deleteMeal(id);
    revision.current += 1;
    const next = mapState(response);
    applyState(next);
    notifyDataChanged('activity', 'leaderboard');
  }, [applyState]);
  const setWater = useCallback(async (glasses: number) => {
    const response = await api.setWater({ date: today(), glasses });
    revision.current += 1;
    const next = mapState(response);
    applyState(next);
    notifyDataChanged('activity', 'leaderboard');
  }, [applyState]);

  return { meals, water, loading, error, refresh, addMeal, addMealsFromScan, updateMeal, deleteMeal, setWater };
}

