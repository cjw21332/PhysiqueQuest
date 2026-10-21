import type { NextFunction, Request, Response } from 'express';
const allowedQueries: Record<string, string[]> = {
  '/api/sync': ['resource', 'since', 'cursor', 'limit'],
  '/api/workouts': ['limit', 'before', 'date', 'timezone'], '/api/workouts/summary': ['timezone'],
  '/api/activity/state': ['timezone'], '/api/progress': ['metric', 'limit'], '/api/leaderboard': ['period'],
  '/api/admin/analytics': ['days'], '/api/admin/alerts': ['days', 'status'], '/api/admin/exercises': ['limit'],
  '/api/exercises': ['search', 'muscle', 'equipment', 'page', 'limit'], '/api/nutrition/foods/search': ['q'],
};
export function queryValidationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Preflight carries the target URL's query but must reach CORS before validation.
  if (req.method === 'OPTIONS') { next(); return; }
  const path = req.path.replace(/^\/api\/v1(?=\/|$)/i, '/api').replace(/\/+$/, '').toLowerCase();
  const allowed = req.method === 'GET' ? allowedQueries[path] ?? [] : [];
  if (Object.entries(req.query).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')) {
    res.status(400).json({ statusCode: 400, code: 'INVALID_REQUEST', message: 'Unknown or invalid query parameter', request_id: (req as Request & { requestId?: string }).requestId }); return;
  }
  next();
}
