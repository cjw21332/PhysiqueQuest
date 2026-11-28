'use client';
import { api, getApiBaseUrl } from '../../../lib/api';
import { Card, Icon, PageHeader, State, formatDate, humanize, useAdminData } from '../ui';

async function readiness() {
  const started = performance.now();
  try {
    const response = await fetch(getApiBaseUrl().replace(/\/api\/?$/i, '/ready'), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const body = await response.json().catch(() => ({}));
    return { ready: response.ok && body.status === 'ready', ms: Math.round(performance.now() - started) as number | null, checkedAt: new Date().toISOString() };
  } catch { return { ready: false, ms: null, checkedAt: new Date().toISOString() }; }
}

export default function Audit() {
  const health = useAdminData(readiness, []);
  const audit = useAdminData(() => api.getAdminAudit(), []);
  const short = (value?: string) => value ? `${value.replace(/^subject:/, '').slice(0, 12)}…` : '—';

  return <main className="adm-page">
    <PageHeader eyebrow="Manage" title="Audit & system" subtitle="Backend health and a record of every administrator action.">
      <button type="button" className="adm-btn adm-btn-ghost" onClick={() => { health.reload(); audit.reload(); }}><Icon name="refresh" size={16} />Refresh</button>
    </PageHeader>
    <div className="adm-grid adm-grid-3">
      <Card eyebrow="Service" title="Backend API">
        <State loading={health.loading} error="">
          {health.data && <div className="adm-health">
            <span className={`adm-dot ${health.data.ready ? 'is-good' : 'is-bad'}`} aria-hidden="true" />
            <div><strong>{health.data.ready ? 'Ready' : 'Not responding'}</strong><small>{health.data.ms !== null ? `${health.data.ms} ms` : 'No response'} · checked {formatDate(health.data.checkedAt, true)}</small></div>
          </div>}
        </State>
        <p className="adm-footnote">On Render&apos;s free plan the first request after idle can take up to a minute.</p>
      </Card>
      <Card eyebrow="Account" title="Administrator">
        <dl className="adm-facts"><div><dt>Username</dt><dd>admin</dd></div><div><dt>Recovery</dt><dd>Reset code by email</dd></div></dl>
        <p className="adm-footnote">To change the password, sign out and use “Forgot password?”.</p>
      </Card>
      <Card eyebrow="Privacy" title="What is logged">
        <p className="adm-sub">Viewing users or feedback, updating reports and adding evidence. IDs are pseudonymised. No message contents or passwords are stored.</p>
      </Card>
    </div>
    <Card eyebrow="History" title="Recent administrator actions" action={<span className="adm-dim">Latest 100</span>}>
      <State loading={audit.loading && !audit.data} error={audit.error} onRetry={audit.reload} empty={audit.data && !audit.data.items.length ? 'No administrator actions recorded yet.' : false}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th scope="col">Time</th><th scope="col">Action</th><th scope="col">Administrator</th><th scope="col">Target</th><th scope="col">Result</th></tr></thead>
          <tbody>{audit.data?.items.map(row => <tr key={row._id}>
            <td data-label="Time">{formatDate(row.occurredAt, true)}</td>
            <td className="adm-cell-main"><strong className="adm-capitalize">{humanize(row.action.replace(/^admin_/, ''))}</strong></td>
            <td className="adm-mono" data-label="Administrator">{short(row.actorId)}</td>
            <td className="adm-mono" data-label="Target">{short(row.targetId)}</td>
            <td data-label="Result">{row.status ? <span className={`adm-pill ${row.status < 400 ? 'is-good' : 'is-bad'}`}>{row.status}</span> : <span className="adm-dim">—</span>}</td>
          </tr>)}</tbody>
        </table></div>
      </State>
    </Card>
  </main>;
}
