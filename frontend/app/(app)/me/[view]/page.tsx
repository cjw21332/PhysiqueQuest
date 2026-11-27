import { notFound } from 'next/navigation';
import MePage from '../page';

export function generateStaticParams() {
  return ['personal-data', 'goals', 'training', 'health', 'emergency-contact', 'personal-exercises', 'feedback'].map(view => ({ view }));
}

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  if (!['personal-data', 'goals', 'training', 'health', 'emergency-contact', 'personal-exercises', 'feedback'].includes((await params).view)) notFound();
  return <MePage />;
}
