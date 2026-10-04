import { useState } from "react";
import { getFood, saveLog, searchFoods } from "../api";
import { AnalyzedItem, FoodCandidate, LogItem, LogTotals, Macros } from "../types";

interface Row {
  id: number;
  food_name: string;
  weight: number;
  found: boolean;
  description?: string;
  fdc_id?: number;
  per_100g?: Macros;
  confidence: number;
}

let rowId = 0;

function computeMacros(r: Row) {
  if (!r.per_100g) return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const f = r.weight / 100;
  return {
    kcal: Math.round(r.per_100g.kcal * f * 10) / 10,
    protein_g: Math.round(r.per_100g.protein_g * f * 10) / 10,
    carbs_g: Math.round(r.per_100g.carbs_g * f * 10) / 10,
    fat_g: Math.round(r.per_100g.fat_g * f * 10) / 10,
  };
}

export default function Review({
  items,
  onDone,
  onCancel,
}: {
  items: AnalyzedItem[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((it) => ({
      id: ++rowId,
      food_name: it.food_name,
      weight: it.est_weight_g,
      found: it.found,
      description: it.description,
      fdc_id: it.fdc_id,
      per_100g: it.per_100g,
      confidence: it.confidence,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState<Record<number, string>>({});
  const [candidates, setCandidates] = useState<Record<number, FoodCandidate[]>>({});

  const totals: LogTotals = rows.reduce(
    (acc, r) => {
      const m = computeMacros(r);
      acc.kcal += m.kcal;
      acc.protein_g += m.protein_g;
      acc.carbs_g += m.carbs_g;
      acc.fat_g += m.fat_g;
      return acc;
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  function setWeight(id: number, w: number) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, weight: Math.max(1, Math.round(w)) } : r)));
  }
  function removeRow(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function doSearch(id: number) {
    const q = searchQ[id];
    if (!q?.trim()) return;
    try {
      const c = await searchFoods(q);
      setCandidates((prev) => ({ ...prev, [id]: c }));
    } catch (e: any) {
      setError(e?.message || "search failed");
    }
  }

  async function pickCandidate(id: number, c: FoodCandidate) {
    try {
      const food = await getFood(c.fdc_id);
      setRows((rs) =>
        rs.map((r) =>
          r.id === id
            ? {
                ...r,
                found: true,
                fdc_id: c.fdc_id,
                description: c.description,
                per_100g: food.per_100g,
                food_name: c.description,
              }
            : r
        )
      );
      setCandidates((prev) => ({ ...prev, [id]: [] }));
    } catch (e: any) {
      setError(e?.message || "lookup failed");
    }
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const logItems: LogItem[] = rows
        .filter((r) => r.per_100g)
        .map((r) => {
          const m = computeMacros(r);
          return { food_name: r.food_name, fdc_id: r.fdc_id, weight_g: r.weight, ...m };
        });
      if (logItems.length === 0) {
        setError("No items with nutrition data to log.");
        setSaving(false);
        return;
      }
      const payload = {
        items: logItems,
        totals: {
          kcal: Math.round(totals.kcal * 10) / 10,
          protein_g: Math.round(totals.protein_g * 10) / 10,
          carbs_g: Math.round(totals.carbs_g * 10) / 10,
          fat_g: Math.round(totals.fat_g * 10) / 10,
        },
      };
      await saveLog(payload);
      onDone();
    } catch (e: any) {
      setError(e?.message || "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="review">
      <h2>Review &amp; confirm</h2>
      <p className="hint">
        Adjust the estimated weight for each item. Macros update live. Remove anything
        wrong before logging.
      </p>

      <div className="totals">
        <div className="total-card">
          <span>{Math.round(totals.kcal)}</span>
          <label>kcal</label>
        </div>
        <div className="total-card">
          <span>{Math.round(totals.protein_g)}g</span>
          <label>protein</label>
        </div>
        <div className="total-card">
          <span>{Math.round(totals.carbs_g)}g</span>
          <label>carbs</label>
        </div>
        <div className="total-card">
          <span>{Math.round(totals.fat_g)}g</span>
          <label>fat</label>
        </div>
      </div>

      <div className="items">
        {rows.map((r) => {
          const m = computeMacros(r);
          return (
            <div className="item-card" key={r.id}>
              <div className="item-head">
                <strong>{r.food_name}</strong>
                {r.found ? (
                  <span className="badge ok">
                    {Math.round(r.confidence * 100)}% match
                  </span>
                ) : (
                  <span className="badge warn">not in USDA</span>
                )}
                <button className="x" onClick={() => removeRow(r.id)} title="remove">
                  ✕
                </button>
              </div>

              {r.found && r.description && r.description !== r.food_name && (
                <div className="sub">{r.description}</div>
              )}

              <div className="weight-row">
                <label>Weight</label>
                <input
                  type="range"
                  min={1}
                  max={1000}
                  value={r.weight}
                  onChange={(e) => setWeight(r.id, Number(e.target.value))}
                />
                <input
                  type="number"
                  min={1}
                  value={r.weight}
                  onChange={(e) => setWeight(r.id, Number(e.target.value))}
                />
                <span>g</span>
              </div>

              <div className="macros">
                <span>{m.kcal} kcal</span>
                <span>P {m.protein_g}g</span>
                <span>C {m.carbs_g}g</span>
                <span>F {m.fat_g}g</span>
              </div>

              {!r.found && (
                <div className="fallback">
                  <div className="search-row">
                    <input
                      type="text"
                      placeholder="Search USDA database…"
                      value={searchQ[r.id] || ""}
                      onChange={(e) =>
                        setSearchQ((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && doSearch(r.id)}
                    />
                    <button onClick={() => doSearch(r.id)}>Search</button>
                  </div>
                  {(candidates[r.id] || []).map((c) => (
                    <button
                      key={c.fdc_id}
                      className="candidate"
                      onClick={() => pickCandidate(r.id, c)}
                    >
                      {c.description} <em>({c.data_type})</em>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="hint">No items. Go back and capture again.</p>}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button onClick={onCancel} disabled={saving}>
          ← Back
        </button>
        <button className="primary" onClick={confirm} disabled={saving}>
          {saving ? "Saving…" : "✓ Add to log"}
        </button>
      </div>
    </section>
  );
}
