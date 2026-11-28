'use client';
import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Card, Icon, PageHeader, SearchBox, Segmented, Stat, State, errorText, formatDate, humanize, useAdminData } from '../ui';

const tone = (agreement: number) => agreement >= 90 ? 'accent' : agreement >= 75 ? 'amber' : 'red';

export default function PoseTracker() {
  const evidence = useAdminData(() => api.getAdminPoseEvidence(), []);
  const coverage = useAdminData(() => api.getPoseTrackerCoverage(), []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'verified' | 'pending' | 'disabled' | 'documentation-mapped'>('');
  const records = useMemo(() => coverage.data?.records ?? [], [coverage.data]);
  const counts = useMemo(() => records.reduce<Record<string, number>>((all, row) => { all[row.validationStatus] = (all[row.validationStatus] ?? 0) + 1; return all; }, {}), [records]);
  const matches = useMemo(() => records.filter(row => (!status || row.validationStatus === status) && `${row.name} ${row.exerciseId}`.toLowerCase().includes(search.trim().toLowerCase())), [records, status, search]);
  const rows = evidence.data ?? [];
  const sets = rows.reduce((sum, row) => sum + row.sets, 0);
  const reviewedReps = rows.reduce((sum, row) => sum + row.verified, 0);
  // Weighted by verified reps, matching the per-exercise formula's denominator.
  const overall = reviewedReps ? rows.reduce((sum, row) => sum + (row.agreement ?? 0) * row.verified, 0) / reviewedReps : null;

  return <main className="adm-page">
    <PageHeader eyebrow="Insights" title="PoseTracker accuracy" subtitle="Rep-count agreement per exercise, from sets you reviewed by hand, plus tracking coverage across the catalogue.">
      <Link className="adm-btn adm-btn-primary" href="/admin/pose-tracker/references"><Icon name="sliders" size={16} />Manage references</Link>
    </PageHeader>

    <div className="adm-stats adm-stats-4">
      <Stat label="Overall agreement" value={overall === null ? '—' : `${overall.toFixed(1)}%`} note={reviewedReps ? `Across ${reviewedReps} reviewed reps` : 'No reviewed sets yet'} tone="accent" />
      <Stat label="Reviewed sets" value={sets} note={`${rows.length} exercises with evidence`} tone="cyan" />
      <Stat label="Verified configurations" value={coverage.data ? (counts.verified ?? 0) : '—'} note={coverage.data ? `of ${coverage.data.totalCatalog} catalogue exercises` : 'Loading…'} tone="violet" />
      <Stat label="Pending review" value={coverage.data ? (counts.pending ?? 0) : '—'} note="Hidden from members until verified" tone="amber" />
    </div>

    <div className="adm-grid adm-grid-main">
      <Card eyebrow="Validation" title="Rep-count agreement by exercise" className="adm-span-2">
        <State loading={evidence.loading && !evidence.data} error={evidence.error} onRetry={evidence.reload} empty={evidence.data && !rows.length ? 'No reviewed sets yet. Log one to start measuring agreement.' : false}>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th scope="col">Exercise</th><th scope="col" className="adm-num">Sets</th><th scope="col" className="adm-num">Verified reps</th><th scope="col">Agreement</th><th scope="col" className="adm-num">Zero-rep false counts</th><th scope="col">Last reviewed</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.exercise}>
              <td><strong>{row.exercise}</strong></td>
              <td className="adm-num">{row.sets}</td>
              <td className="adm-num">{row.verified}</td>
              <td>{row.agreement === null ? <span className="adm-dim">Needs reps &gt; 0</span> : <span className="adm-meter"><span className="adm-meter-track"><span className={`tone-${tone(row.agreement)}`} style={{ width: `${row.agreement}%` }} /></span><strong>{row.agreement.toFixed(1)}%</strong></span>}</td>
              <td className="adm-num">{row.zeroRepFalsePositives} / {row.zeroRepSets}</td>
              <td>{formatDate(row.lastReviewed)}</td>
            </tr>)}</tbody>
          </table></div>
        </State>
        <p className="adm-footnote">Agreement = 1 − |counted − verified| ÷ verified reps, floored at 0%. It describes the reviewed sets only. It is not form accuracy.</p>
      </Card>
      <EvidenceForm names={records.map(row => row.name)} onSaved={evidence.reload} />
    </div>

    <Card eyebrow="Coverage" title="Tracking configurations" action={<SearchBox value={search} onChange={setSearch} label="Search configurations" placeholder="Search exercise" />}>
      <div className="adm-toolbar adm-toolbar-flush">
        <Segmented label="Configuration status" value={status} onChange={setStatus} options={[['', `All ${records.length}`], ['verified', `Verified ${counts.verified ?? 0}`], ['pending', `Pending ${counts.pending ?? 0}`], ['documentation-mapped', `Mapped ${counts['documentation-mapped'] ?? 0}`], ['disabled', `Disabled ${counts.disabled ?? 0}`]]} />
      </div>
      <State loading={coverage.loading && !coverage.data} error={coverage.error} onRetry={coverage.reload} empty={coverage.data && !matches.length ? 'No configurations match.' : false}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th scope="col">Exercise</th><th scope="col">Mode</th><th scope="col">Camera</th><th scope="col">Equipment</th><th scope="col">Status</th></tr></thead>
          <tbody>{matches.slice(0, 100).map(row => <tr key={row.exerciseId}>
            <td><strong>{row.name}</strong></td>
            <td>{humanize(row.trackingMode)}</td>
            <td>{row.cameraOrientation}</td>
            <td className="adm-dim">{row.equipment.join(', ') || '—'}</td>
            <td><span className={`adm-pill vs-${row.validationStatus}`}>{humanize(row.validationStatus)}</span></td>
          </tr>)}</tbody>
        </table></div>
        {matches.length > 100 && <p className="adm-footnote">Showing 100 of {matches.length} matches. Search to narrow the list.</p>}
      </State>
    </Card>
  </main>;
}

function EvidenceForm({ names, onSaved }: { names: string[]; onSaved: () => void }) {
  const [exercise, setExercise] = useState('');
  const [verified, setVerified] = useState('');
  const [predicted, setPredicted] = useState('');
  const [conditions, setConditions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api.addAdminPoseEvidence({ exercise: exercise.trim(), verified: Number(verified), predicted: Number(predicted), conditions: conditions.trim() });
      setExercise(''); setVerified(''); setPredicted(''); setConditions(''); setNotice('Reviewed set saved.'); onSaved();
    } catch (e) { setError(errorText(e, 'Could not save the reviewed set.')); }
    finally { setBusy(false); }
  }
  return <Card eyebrow="Add evidence" title="Log a reviewed set">
    <form className="adm-form" onSubmit={submit}>
      <p className="adm-sub">Count the full reps in a recording yourself, then enter what PoseTracker counted.</p>
      <label className="adm-field">Exercise<input required maxLength={100} list="adm-exercise-names" value={exercise} onChange={e => setExercise(e.target.value)} placeholder="e.g. Push-up" /></label>
      <datalist id="adm-exercise-names">{[...new Set(names)].map(name => <option key={name} value={name} />)}</datalist>
      <div className="adm-form-row">
        <label className="adm-field">Verified reps<input required type="number" inputMode="numeric" min="0" max="10000" step="1" value={verified} onChange={e => setVerified(e.target.value)} /></label>
        <label className="adm-field">Counted reps<input required type="number" inputMode="numeric" min="0" max="10000" step="1" value={predicted} onChange={e => setPredicted(e.target.value)} /></label>
      </div>
      <label className="adm-field">Camera and equipment<input maxLength={300} value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Side view, 2 m, dumbbells" /><small className="adm-dim">No personal details.</small></label>
      {error && <p role="alert" className="adm-form-error"><Icon name="alert" size={16} />{error}</p>}
      {notice && <p role="status" className="adm-form-notice">{notice}</p>}
      <button className="adm-btn adm-btn-primary adm-btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save reviewed set'}</button>
    </form>
  </Card>;
}
