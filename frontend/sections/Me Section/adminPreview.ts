import type { AdminAnalyticsRecord } from '../../lib/api';

export type AdminExercise = { targetMuscle?: string; equipment?: string; _id: string; name: string; group: string; status: 'draft' | 'published'; pose: 'missing' | 'ready' | 'training' };
export type ExerciseFilter = 'All' | 'published' | 'draft' | 'missing';
export const adminExercisesPreview: AdminExercise[] = [
  { _id: 'preview-bench', name: 'Dumbbell bench press', group: 'Chest · Dumbbells', status: 'published', pose: 'ready' },
  { _id: 'preview-overhead', name: 'Overhead press', group: 'Shoulders · Dumbbells', status: 'published', pose: 'ready' },
  { _id: 'preview-squat', name: 'Bulgarian split squat', group: 'Legs · Dumbbells', status: 'draft', pose: 'missing' },
  { _id: 'preview-cable', name: 'Cable fly', group: 'Chest · Machine', status: 'published', pose: 'ready' },
  { _id: 'preview-swing', name: 'Kettlebell swing', group: 'Legs · Kettlebell', status: 'draft', pose: 'training' },
  { _id: 'preview-band', name: 'Band pull-apart', group: 'Back · Bands', status: 'draft', pose: 'missing' },
];
export const filterAdminExercises = (items: AdminExercise[], filter: ExerciseFilter, query: string) => items.filter(item => (filter === 'All' || (filter === 'missing' ? item.pose === 'missing' : item.status === filter)) && `${item.name} ${item.group}`.toLowerCase().includes(query.trim().toLowerCase()));
export type PreviewAnalytics = AdminAnalyticsRecord & { growth: number; sessionsToday: number; cancelled: number };
export function analyticsPreview(range: 7 | 30 | 90): PreviewAnalytics {
  const value = range === 30 ? { active: 1284, growth: 8.2, sessions: 312, form: 84, missions: 67, triggered: 14, cancelled: 9, notified: 5 } : range === 7 ? { active: 428, growth: 5.1, sessions: 96, form: 81, missions: 65, triggered: 4, cancelled: 3, notified: 1 } : { active: 3026, growth: 10.4, sessions: 526, form: 85, missions: 70, triggered: 42, cancelled: 25, notified: 17 };
  return { rangeDays: range, generatedAt: '', usersTotal: value.active, activeUsers: value.active, completedSessions: value.sessions, formScore: value.form, missionCompletion: value.missions, weeklyRetention: range === 30 ? [38, 44, 42, 49, 53, 59, 57, 66] : range === 7 ? [31, 36, 34, 40, 45, 47, 51, 55] : [41, 48, 45, 53, 56, 63, 60, 72], growth: value.growth, sessionsToday: value.sessions, cancelled: value.cancelled, emergencyEvents: { total: value.triggered, delivered: value.notified, failed: 0, pending: 0 } };
}
export function analyticsCsv(rows: (string | number)[][]) { return rows.map(row => row.map(value => `"${(typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? `'${value}` : String(value)).replace(/"/g, '""')}"`).join(',')).join('\r\n'); }
