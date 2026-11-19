import { notFound } from 'next/navigation';
import HomePage from '../page';

export function generateStaticParams() {
  return ['notifications'].map(view => ({ view }));
}

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  if ((await params).view !== 'notifications') notFound();
  return <HomePage />;
}
