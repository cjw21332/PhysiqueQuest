import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PhysiqueQuest — Training that fits you',
  description: 'Your personal, AI-assisted fitness journey starts here.',
  icons: {
    icon: '/physiquequest-icon.png',
    shortcut: '/physiquequest-icon.png',
    apple: '/physiquequest-icon.png',
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PhysiqueQuest' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-zoom for accessibility, but let the layout cover the display
  // cutout/notch so env(safe-area-inset-*) resolves to real values.
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#f3f6f2',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
