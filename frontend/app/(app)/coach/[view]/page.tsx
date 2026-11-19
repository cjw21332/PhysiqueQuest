import { notFound } from 'next/navigation';
import CoachPage from '../page';

export function generateStaticParams() {
  return ['library', 'prepare', 'session', 'report'].map(view => ({ view }));
}

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  if (!['library', 'prepare', 'session', 'report'].includes((await params).view)) notFound();
  return <CoachPage />;
}
