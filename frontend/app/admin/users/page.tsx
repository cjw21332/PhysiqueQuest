'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { Avatar, Card, Icon, PageHeader, Pagination, SearchBox, State, errorText, formatDate, useAdminData } from '../ui';

type Profile = NonNullable<Awaited<ReturnType<typeof api.getAdminUser>>>;

export default function Users() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const { data, error, loading, reload } = useAdminData(() => api.getAdminUsers(query, page), [query, page]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  // Photos load after the rows so the list never waits on large images.
  useEffect(() => {
    const ids = data?.items.map(user => user._id) ?? [];
    if (!ids.length) return;
    let active = true;
    api.getAdminPhotos(ids).then(result => { if (active) setPhotos(current => ({ ...current, ...result.photos })); }).catch(() => undefined);
    return () => { active = false; };
  }, [data]);

  return <main className="adm-page">
    <PageHeader eyebrow="Monitor" title="Users" subtitle="Every PhysiqueQuest member. Open a row for their profile, split and badges." />
    <Card title="User directory" action={<SearchBox value={search} onChange={setSearch} label="Search users" placeholder="Search name or email" />}>
      <State loading={loading && !data} error={error} onRetry={reload} empty={data && !data.items.length ? (query ? 'No users match this search.' : 'No users yet.') : false}>
        {data && <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th scope="col">Member</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col">Last sign-in</th><th scope="col"><span className="adm-sr">Profile</span></th></tr></thead>
            <tbody>{data.items.map(user => <tr key={user._id} className="is-clickable" onClick={() => setOpenId(user._id)}>
              <td><span className="adm-person"><Avatar name={user.name} photo={photos[user._id]} /><span><strong>{user.name}</strong><small>{user.email}</small></span></span></td>
              <td><span className={`adm-pill ${user.isActive ? 'is-good' : 'is-muted'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
              <td>{formatDate(user.createdAt)}</td>
              <td>{user.lastSignIn ? formatDate(user.lastSignIn) : <span className="adm-dim">Not recorded</span>}</td>
              <td className="adm-cell-end"><button type="button" className="adm-btn adm-btn-ghost" onClick={event => { event.stopPropagation(); setOpenId(user._id); }}>View profile<Icon name="right" size={14} /></button></td>
            </tr>)}</tbody>
          </table></div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>}
      </State>
    </Card>
    {openId && <ProfileDrawer id={openId} onClose={() => setOpenId(null)} />}
  </main>;
}

function ProfileDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  useEffect(() => {
    let active = true; setProfile(null); setError('');
    api.getAdminUser(id).then(value => { if (!active) return; if (value) setProfile(value); else setError('This user no longer exists.'); })
      .catch(e => { if (active) setError(errorText(e, 'Could not load this profile.')); });
    return () => { active = false; };
  }, [id]);
  const p = profile?.profile;
  const height = p?.height ? (p.heightInches ? `${p.height} ft ${p.heightInches} in` : `${p.height} ${p.heightUnit ?? ''}`) : null;
  const facts: [string, string | null | undefined][] = [['Age', p?.age ? `${p.age} yrs` : null], ['Height', height], ['Weight', p?.weight ? `${p.weight} ${p.weightUnit ?? ''}` : null], ['Goal', p?.goal]];

  return <dialog ref={ref} className="adm-drawer" aria-labelledby="adm-drawer-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="adm-drawer-body">
      <div className="adm-drawer-head">
        <p className="adm-eyebrow">Member profile</p>
        <button type="button" className="adm-btn adm-btn-ghost adm-btn-icon" onClick={onClose} aria-label="Close profile"><Icon name="close" /></button>
      </div>
      <State loading={!profile && !error} error={error}>
        {profile && <>
          <div className="adm-profile-id"><Avatar large name={p?.name || profile.user.name} photo={profile.photo} /><div><h2 id="adm-drawer-title">{p?.name || profile.user.name}</h2><p className="adm-sub">{profile.user.email}</p></div></div>
          <dl className="adm-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="adm-dim">Not set</span>}</dd></div>)}</dl>
          <h3>Current split</h3>
          {profile.split?.length ? <ol className="adm-split">{profile.split.map((day, index) => <li key={`${day.label}-${index}`} className={day.isWorkoutDay ? 'is-work' : 'is-rest'}>
            <strong>{day.label}</strong><span>{day.isWorkoutDay ? (day.exercises.length ? day.exercises.join(', ') : 'Workout day') : 'Rest'}</span>
          </li>)}</ol> : <p className="adm-state">No saved coach plan matches this member&apos;s current setup.</p>}
          <h3>Badges earned {profile.badges ? <span className="adm-count">{profile.badges.length}</span> : null}</h3>
          {profile.badges ? (profile.badges.length ? <ul className="adm-badges">{profile.badges.map(badge => <li key={badge.id}>{badge.title}</li>)}</ul> : <p className="adm-state">No badges earned yet.</p>) : <p className="adm-state">Badges are unavailable for this member.</p>}
          {profile.badges && profile.badgeCoverageIncomplete && <p className="adm-footnote">Some badges can&apos;t be evaluated from server data yet.</p>}
        </>}
      </State>
    </div>
  </dialog>;
}
