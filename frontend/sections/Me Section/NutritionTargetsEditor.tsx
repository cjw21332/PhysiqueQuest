'use client';
import { useEffect, useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { nutritionTargets } from '../Scan/types';
export default function NutritionTargetsEditor() {
  const { settings, loading, error, updateSettings } = useSettings();
  const [draft, setDraft] = useState({ ...nutritionTargets });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setDraft(settings.nutritionTargets ?? { ...nutritionTargets });
  }, [settings.nutritionTargets]);
  return (
    <details className="nutrition-target-editor">
      <summary>Daily nutrition targets</summary>
      <p>
        {settings.nutritionTargets
          ? 'Your saved targets are shared by Home, Nutrition and food history.'
          : 'These are default targets. Set your own values; the app does not calculate a personalized diet.'}
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            await updateSettings({ nutritionTargets: draft });
            setMessage('Targets saved.');
          } catch (err) {
            setMessage(String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {(Object.keys(draft) as (keyof typeof draft)[]).map((key) => (
          <label key={key}>
            {key === 'calories'
              ? 'Calories (kcal)'
              : `${key[0].toUpperCase() + key.slice(1)} (g)`}
            <input
              aria-label={`Daily ${key} target`}
              required
              type="number"
              min={key === 'calories' ? 1 : 0}
              max={key === 'calories' ? 10000 : key === 'carbs' ? 2000 : 1000}
              step={1}
              value={draft[key]}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  [key]: Number(event.target.value),
                }))
              }
            />
          </label>
        ))}
        <button type="submit" className="secondary" disabled={loading || busy}>
          {busy ? 'Saving…' : 'Save nutrition targets'}
        </button>
      </form>
      {(message || error) && <p role="status">{message || error}</p>}
    </details>
  );
}
