import type { Metadata, Viewport } from 'next';
import './globals.css';
import './theme.css';
import './scrollbars.css';
import SessionBoundary from '../components/SessionBoundary';

export const metadata: Metadata = {
  title: 'PhysiqueQuest — Training that fits you',
  description: 'Your personal, AI-assisted fitness journey starts here.',
  icons: {
    icon: '/physiquequest-icon.png',
    shortcut: '/physiquequest-icon.png',
    apple: '/physiquequest-icon.png',
  },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PhysiqueQuest' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-zoom for accessibility, but let the layout cover the display
  // cutout/notch so env(safe-area-inset-*) resolves to real values.
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0b0f15',
  colorScheme: 'dark',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The Expo WebView injects native safe-area CSS variables on <html> before
  // hydration, so its initial style attribute intentionally differs from SSR.
  return <html lang="en" data-theme="dark" suppressHydrationWarning><body><SessionBoundary>{children}</SessionBoundary></body></html>;
}
