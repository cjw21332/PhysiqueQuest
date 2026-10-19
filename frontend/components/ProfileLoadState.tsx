'use client';

export default function ProfileLoadState({ loading, error, onRetry }: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <main className="scene">
      <div className="app-shell">
        <section className="profile-load-state" role={error ? 'alert' : 'status'} aria-live="polite" aria-busy={loading} aria-label={loading ? 'Loading content' : undefined}>
          {loading ? <div className="section-placeholder" aria-hidden="true" /> : <>
            <h2>Could not load your profile</h2>
            <p>{error} Check that the backend and database are running, then try again.</p>
            <button className="primary" onClick={onRetry}>Try again</button>
          </>}
        </section>
      </div>
    </main>
  );
}
