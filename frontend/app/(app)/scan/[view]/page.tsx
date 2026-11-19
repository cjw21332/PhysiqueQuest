import { notFound, redirect } from 'next/navigation';
import ScanPage from '../page';

export function generateStaticParams() {
  return ['today', 'plan', 'history', 'add-food', 'review', 'edit-meal'].map(view => ({ view }));
}

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (view === 'today') redirect('/scan');
  if (!['plan', 'history', 'add-food', 'review', 'edit-meal'].includes(view)) notFound();
  return <ScanPage />;
}
