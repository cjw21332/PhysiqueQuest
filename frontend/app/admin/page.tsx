"use client";
import { useRouter } from 'next/navigation';
import EngagementAnalytics from '../../sections/Me Section/EngagementAnalytics';

export default function AdminDashboard() {
  const router = useRouter();
  return <main className="scene"><EngagementAnalytics onBack={() => router.push('/home')}/></main>;
}
