import { notFound } from 'next/navigation';
import MePage from '../page';

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  if (!['personal-data', 'goals', 'training', 'health', 'emergency-contact', 'exercises', 'engagement'].includes((await params).view)) notFound();
  return <MePage />;
}
