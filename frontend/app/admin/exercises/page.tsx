'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Card, PageHeader, SearchBox, Segmented, Stat, State, useAdminData } from '../ui';

export default function ExerciseFeedback() {
  const [source, setSource] = useState<'' | 'pose' | 'manual'>('');
  const [days, setDays] = useState<'' | '7' | '30' | '90'>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
  const { data, error, loading, reload } = useAdminData(() => api.getAdminExerciseFeedback({ source, search: query, days }), [source, query, days]);
  const rows = data ?? [];
  const responses = rows.reduce((sum, row) => sum + row.responses, 0);
  const rpe = responses ? rows.reduce((sum, row) => sum + (row.averageRpe ?? 0) * row.responses, 0) / responses : null;
  const hard = rows.reduce((sum, row) => sum + row.tooHard, 0), easy = rows.reduce((sum, row) => sum + row.tooEasy, 0);

  return <main className="adm-page">
    <PageHeader eyebrow="Feedback" title="Exercise feedback" subtitle="How workouts felt, from the post-set check-in in the mobile app. Pain reports and private notes are never shown here." />
    <div className="adm-toolbar">
      <Segmented label="Tracking source" value={source} onChange={setSource} options={[['', 'All sources'], ['pose', 'PoseTracker'], ['manual', 'Manual']]} />
      <Segmented label="Period" value={days} onChange={setDays} options={[['', 'All time'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days']]} />
      <SearchBox value={search} onChange={setSearch} label="Search exercises" placeholder="Search exercise" />
    </div>
    <State loading={loading && !data} error={error} onRetry={reload}>
      <div className="adm-stats adm-stats-4">
        <Stat label="Responses" value={responses.toLocaleString()} note="Check-ins in the filtered groups" />
        <Stat label="Exercises" value={rows.length} note="Exercise and source pairs" tone="cyan" />
        <Stat label="Average effort" value={rpe === null ? '—' : `${rpe.toFixed(1)} RPE`} note="Weighted by responses, out of 10" tone="violet" />
        <Stat label="Felt too hard" value={responses ? `${Math.round((hard / responses) * 100)}%` : '—'} note={responses ? `${Math.round((easy / responses) * 100)}% said too easy` : 'No responses'} tone="amber" />
      </div>
      <Card title="By exercise" eyebrow="Top 100 groups by responses" action={<ul className="adm-legend"><li><i className="tone-cyan" />Too easy</li><li><i className="tone-accent" />Just right</li><li><i className="tone-red" />Too hard</li></ul>}>
        {rows.length ? <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th scope="col">Exercise</th><th scope="col">Source</th><th scope="col" className="adm-num">Responses</th><th scope="col" className="adm-num">Avg RPE</th><th scope="col" className="adm-num">Enjoyment</th><th scope="col">Difficulty split</th></tr></thead>
          <tbody>{rows.map(row => {
            const total = Math.max(1, row.tooEasy + row.justRight + row.tooHard);
            return <tr key={`${row._id.exercise}:${row._id.source}`}>
              <td className="adm-cell-main"><strong>{row._id.exercise}</strong></td>
              <td data-label="Source"><span className={`adm-pill ${row._id.source === 'pose' ? 'is-info' : 'is-muted'}`}>{row._id.source === 'pose' ? 'PoseTracker' : 'Manual'}</span></td>
              <td className="adm-num" data-label="Responses">{row.responses}</td>
              <td className="adm-num" data-label="Avg RPE">{row.averageRpe?.toFixed(1) ?? '—'}</td>
              <td className="adm-num" data-label="Enjoyment">{row.averageEnjoyment ? `${row.averageEnjoyment.toFixed(1)}/5` : '—'}</td>
              <td data-label="Difficulty"><span className="adm-stack" role="img" aria-label={`${row.tooEasy} too easy, ${row.justRight} just right, ${row.tooHard} too hard`}>
                <span className="tone-cyan" style={{ width: `${(row.tooEasy / total) * 100}%` }} /><span className="tone-accent" style={{ width: `${(row.justRight / total) * 100}%` }} /><span className="tone-red" style={{ width: `${(row.tooHard / total) * 100}%` }} />
              </span><small className="adm-dim">{row.tooEasy} / {row.justRight} / {row.tooHard}</small></td>
            </tr>;
          })}</tbody>
        </table></div> : <div className="adm-state">No exercise feedback matches these filters.</div>}
      </Card>
    </State>
  </main>;
}
