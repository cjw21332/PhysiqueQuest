'use client';
import { api } from '../../../lib/api';
import { BarList, Card, Icon, PageHeader, Stat, State, humanize, useAdminData } from '../ui';

export default function FoodAnalytics() {
  const { data, error, loading, reload } = useAdminData(() => api.getAdminFoods(), []);
  const attempts = data?.scans.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const succeeded = data?.scans.filter(row => row.status === 'success').reduce((sum, row) => sum + row.count, 0) ?? 0;

  return <main className="adm-page">
    <PageHeader eyebrow="Insights" title="Food analytics" subtitle="What members log and scan in the nutrition tracker.">
      <button type="button" className="adm-btn adm-btn-ghost" onClick={reload} disabled={loading}><Icon name="refresh" size={16} />Refresh</button>
    </PageHeader>
    <State loading={loading && !data} error={error} onRetry={reload}>
      {data && <>
        <div className="adm-stats adm-stats-4">
          <Stat label="Logged food entries" value={data.meals.toLocaleString()} note="All saved meal entries, all time" />
          <Stat label="Entries from scans" value={data.savedScanEntries.toLocaleString()} note={data.meals ? `${Math.round((data.savedScanEntries / data.meals) * 100)}% of logged entries` : 'No entries yet'} tone="cyan" />
          <Stat label="Scan attempts" value={attempts.toLocaleString()} note="Retained scan records only" tone="violet" />
          <Stat label="Scan success" value={attempts ? `${Math.round((succeeded / attempts) * 100)}%` : '—'} note="Successful attempts / retained attempts" tone="accent" />
        </div>
        <div className="adm-grid adm-grid-main">
          <Card eyebrow="Popular" title="Most logged foods" className="adm-span-2">
            {data.top.length ? <BarList rows={data.top.map(row => ({ label: row._id, value: row.count }))} unit="entries" /> : <div className="adm-state">No food entries yet.</div>}
          </Card>
          <Card eyebrow="Scanner" title="Scan outcomes">
            {data.scans.length ? <BarList rows={[...data.scans].sort((a, b) => b.count - a.count).map(row => ({ label: humanize(String(row.status ?? 'unknown')), value: row.count }))} unit="scans" tone="violet" /> : <div className="adm-state">No retained scan attempts.</div>}
            <p className="adm-footnote">Scan records expire after a limited period, so missing outcomes don&apos;t mean zero. One saved scan can add several food entries.</p>
          </Card>
        </div>
      </>}
    </State>
  </main>;
}
