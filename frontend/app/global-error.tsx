'use client';
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error); }, [error]);
  return <html><body><h1>Something went wrong</h1><p>Please try again.</p><button onClick={reset}>Retry</button></body></html>;
}
