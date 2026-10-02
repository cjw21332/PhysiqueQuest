import { redirect } from 'next/navigation';

/**
 * Send the first request straight to the server-rendered launch screen.
 * Keeping this redirect server-side prevents Expo Go WebView from getting
 * stranded on a client-only splash page when hydration is delayed.
 */
export default function HomePage() {
  redirect('/launch');
}
