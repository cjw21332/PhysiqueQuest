import { notFound } from 'next/navigation';
import ScanPage from '../page';

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  if (!['plan', 'today', 'history', 'add-food', 'review', 'edit-meal'].includes((await params).view)) notFound();
  return <ScanPage />;
}
