import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getLogs } from "../api";
import { LogTotals, StoredLog } from "../types";

export default function Dashboard() {
  const [logs, setLogs] = useState<StoredLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLogs()
      .then(setLogs)
      .catch((e) => setError(e?.message || "load failed"));
  }, []);

  const today = new Date();
  const days: { day: string; kcal: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const kcal = logs
      .filter((l) => l.timestamp.slice(0, 10) === key)
      .reduce((s, l) => s + l.payload.totals.kcal, 0);
    days.push({
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      kcal: Math.round(kcal),
    });
  }

  const todayKey = today.toISOString().slice(0, 10);
  const todayTotals: LogTotals = logs
    .filter((l) => l.timestamp.slice(0, 10) === todayKey)
    .reduce(
      (acc, l) => {
        acc.kcal += l.payload.totals.kcal;
        acc.protein_g += l.payload.totals.protein_g;
        acc.carbs_g += l.payload.totals.carbs_g;
        acc.fat_g += l.payload.totals.fat_g;
        return acc;
      },
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

  const macroData = [
    { name: "Protein", grams: Math.round(todayTotals.protein_g) },
    { name: "Carbs", grams: Math.round(todayTotals.carbs_g) },
    { name: "Fat", grams: Math.round(todayTotals.fat_g) },
  ];

  return (
    <section className="dashboard">
      <h2>Dashboard</h2>

      <div className="totals">
        <div className="total-card">
          <span>{Math.round(todayTotals.kcal)}</span>
          <label>kcal today</label>
        </div>
        <div className="total-card">
          <span>{Math.round(todayTotals.protein_g)}g</span>
          <label>protein</label>
        </div>
        <div className="total-card">
          <span>{Math.round(todayTotals.carbs_g)}g</span>
          <label>carbs</label>
        </div>
        <div className="total-card">
          <span>{Math.round(todayTotals.fat_g)}g</span>
          <label>fat</label>
        </div>
      </div>

      <div className="charts">
        <div className="chart-box">
          <h3>Calories — last 7 days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="kcal" fill="#4caf50" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box">
          <h3>Today's macros (g)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={macroData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="grams" fill="#2196f3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h3>Recent meals</h3>
      <div className="logs">
        {logs.length === 0 && <p className="hint">No meals logged yet.</p>}
        {logs.map((l) => (
          <div className="log-card" key={l.id}>
            <div className="log-head">
              <span>{new Date(l.timestamp).toLocaleString()}</span>
              <span className="log-kcal">{Math.round(l.payload.totals.kcal)} kcal</span>
            </div>
            <div className="log-items">
              {l.payload.items.map((it, i) => (
                <span key={i} className="chip">
                  {it.food_name} · {it.weight_g}g · {Math.round(it.kcal)} kcal
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
