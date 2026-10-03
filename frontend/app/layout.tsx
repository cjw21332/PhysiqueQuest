import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PhysiqueQuest — Training that fits you',
  description: 'Your personal, AI-assisted fitness journey starts here.',
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
  return <html lang="en" suppressHydrationWarning>
    <head>
      <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('physiquequest-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}" }}/>
    </head>
    <body>{children}</body>
  </html>;
}
