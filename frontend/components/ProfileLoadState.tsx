'use client';

export default function ProfileLoadState({ loading, error, onRetry }: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <main className="scene">
      <div className="app-shell">
        <section className="profile-load-state" role={error ? 'alert' : 'status'} aria-live="polite">
          <h2>{loading ? 'Loading your profile…' : 'Could not load your profile'}</h2>
          <p>{loading ? 'Connecting to PhysiqueQuest and your saved profile.' : `${error} Check that the backend and database are running, then try again.`}</p>
          {!loading && <button className="primary" onClick={onRetry}>Try again</button>}
        </section>
      </div>
    </main>
  );
}
