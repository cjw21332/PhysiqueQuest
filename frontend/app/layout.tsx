import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PhysiqueQuest — Training that fits you',
  description: 'Your personal, AI-assisted fitness journey starts here.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'PhysiqueQuest' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#f3f6f2' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
