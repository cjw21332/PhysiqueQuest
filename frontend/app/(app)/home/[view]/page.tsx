import { notFound } from 'next/navigation';
import HomePage from '../page';

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  if ((await params).view !== 'notifications') notFound();
  return <HomePage />;
}
