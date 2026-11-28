'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../../lib/api';
import { Icon, PageHeader, Pagination, SearchBox, Segmented, State, errorText, formatDate, humanize, useAdminData } from '../ui';

type Row = Awaited<ReturnType<typeof api.getAdminFeedback>>['items'][number];
type Status = 'new' | 'in_progress' | 'resolved';
const statuses: [Status, string][] = [['new', 'New'], ['in_progress', 'In progress'], ['resolved', 'Resolved']];

export default function Feedback() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | Status>('');
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [rating, setRating] = useState('');
  const [version, setVersion] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => setPage(1), [status, category, platform, rating, version, from, to, query]);
  const filters = { status, category, platform, rating, version: version.trim(), from, to, search: query };
  const { data, error, loading, reload } = useAdminData(() => api.getAdminFeedback(page, filters), [page, ...Object.values(filters)]);
  const filtered = Boolean(status || category || platform || rating || version || from || to || query);
  const clear = () => { setStatus(''); setCategory(''); setPlatform(''); setRating(''); setVersion(''); setFrom(''); setTo(''); setSearch(''); };

  return <main className="adm-page">
    <PageHeader eyebrow="Feedback" title="App feedback" subtitle="Reports sent from Me › Send feedback in the mobile app. Triage, note and resolve them here.">
      <button type="button" className="adm-btn adm-btn-ghost" onClick={reload} disabled={loading}><Icon name="refresh" size={16} />Refresh</button>
    </PageHeader>

    <div className="adm-toolbar">
      <Segmented label="Status" value={status} onChange={setStatus} options={[['', 'All'], ...statuses]} />
      <SearchBox value={search} onChange={setSearch} label="Search messages" placeholder="Search messages" />
    </div>
    <div className="adm-toolbar adm-toolbar-filters">
      <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All</option><option value="bug">Bug</option><option value="idea">Idea</option><option value="praise">Praise</option><option value="other">Other</option></select></label>
      <label>Platform<select value={platform} onChange={e => setPlatform(e.target.value)}><option value="">All</option><option value="android">Android</option><option value="ios">iOS</option><option value="web">Web</option></select></label>
      <label>Rating<select value={rating} onChange={e => setRating(e.target.value)}><option value="">All</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}</select></label>
      <label>App version<input value={version} maxLength={40} onChange={e => setVersion(e.target.value)} placeholder="e.g. 1.6.9" /></label>
      <label>From (UTC)<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>To (UTC)<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      {filtered && <button type="button" className="adm-link" onClick={clear}>Clear filters</button>}
    </div>

    <div className="adm-inbox">
      <section className="adm-card adm-inbox-list" aria-label="Feedback reports">
        <div className="adm-card-head"><h2>Reports <span className="adm-count">{data?.total ?? '—'}</span></h2></div>
        <State loading={loading && !data} error={error} onRetry={reload} empty={data && !data.items.length ? 'No feedback matches these filters.' : false}>
          {data && <>
            <ul>{data.items.map(row => <li key={row._id}>
              <button type="button" className={selected?._id === row._id ? 'is-selected' : ''} onClick={() => setSelected(row)} aria-pressed={selected?._id === row._id}>
                <span className="adm-inbox-top"><span className={`adm-chip cat-${row.category}`}>{row.category}</span><span className={`adm-pill st-${row.adminStatus ?? 'new'}`}>{humanize(row.adminStatus ?? 'new')}</span><span className="adm-inbox-date">{formatDate(row.createdAt)}</span></span>
                <span className="adm-inbox-msg">{row.message}</span>
                <span className="adm-inbox-meta">{row.rating}/5 · {row.platform || 'unknown platform'} · v{row.appVersion || '?'}</span>
              </button>
            </li>)}</ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>}
        </State>
      </section>
      <section className="adm-card adm-inbox-detail" aria-live="polite">
        {selected ? <Detail key={selected._id} row={selected} onSaved={() => { setSelected(null); reload(); }} /> : <div className="adm-state adm-state-tall"><Icon name="inbox" size={28} />Select a report to read and triage it.</div>}
      </section>
    </div>
  </main>;
}

function Detail({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const [status, setStatus] = useState<Status>(row.adminStatus ?? 'new');
  const [note, setNote] = useState(row.adminNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.updateAdminFeedback(row._id, status, note); onSaved(); }
    catch (e) { setError(errorText(e, 'Could not save this report.')); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="adm-detail">
    <div className="adm-detail-meta"><span className={`adm-chip cat-${row.category}`}>{row.category}</span><span aria-label={`${row.rating} out of 5`}>{'★'.repeat(row.rating)}<span className="adm-dim">{'★'.repeat(Math.max(0, 5 - row.rating))}</span></span></div>
    <blockquote>{row.message}</blockquote>
    <dl className="adm-facts adm-facts-3">
      <div><dt>Received</dt><dd>{formatDate(row.createdAt, true)}</dd></div>
      <div><dt>Platform</dt><dd>{row.platform || 'Unknown'}</dd></div>
      <div><dt>App version</dt><dd>{row.appVersion || 'Unknown'}</dd></div>
    </dl>
    <fieldset className="adm-fieldset"><legend>Status</legend><Segmented label="Report status" value={status} onChange={setStatus} options={statuses} /></fieldset>
    <label className="adm-field">Internal note<textarea rows={4} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Visible to administrators only" /><small className="adm-dim">{note.length}/1000</small></label>
    {error && <p role="alert" className="adm-form-error"><Icon name="alert" size={16} />{error}</p>}
    <div className="adm-detail-actions"><button className="adm-btn adm-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
  </form>;
}
