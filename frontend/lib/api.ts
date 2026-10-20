// API client configuration
import { clearAuthSession } from './session';
import { resolveApiBaseUrl } from './apiBaseUrl.mjs';
import { resolveCoachBaseUrl } from './coachBaseUrl.mjs';
import { createDeviceCache } from './deviceCache.mjs';

export const deviceCache = createDeviceCache({
  context: () => {
    if (typeof window === 'undefined') return null;
    try {
      const user = JSON.parse(localStorage.getItem('physiquequest-auth') ?? 'null');
      return user?.id && user?.token ? { scope: `${getApiBaseUrl()}:${user.id}`, session: user.token } : null;
    } catch { return null; }
  },
  storage: () => typeof window === 'undefined' ? undefined : window.localStorage,
  validate: (key, data) => {
    if (!data || typeof data !== 'object') return false;
    if (key === 'profile') return typeof data.name === 'string';
    if (key === 'coach') return Array.isArray(data.days) && data.days.every((day: any) => day && Array.isArray(day.exercises));
    if (key === 'nutrition') return Array.isArray(data.meals) && Array.isArray(data.water);
    return data.state && typeof data.state === 'object' && Array.isArray(data.dailyMissions);
  },
});

export function getCoachApiBaseUrl() {
  let runtime: string | undefined;
  try { if (typeof window !== 'undefined') runtime = localStorage.getItem('physiquequest-runtime-coach-url') ?? undefined; } catch { /* Optional runtime override. */ }
  const base = resolveCoachBaseUrl(process.env.NEXT_PUBLIC_COACH_API_URL, runtime, typeof window === 'undefined' ? undefined : window.location);
  if (!base) throw new Error('The AI Coach service address is invalid. Check the app connection settings.');
  return base;
}

export function getApiBaseUrl() {
  let runtimeApiUrl: string | undefined;
  let pageLocation: { protocol: string; hostname: string } | undefined;
  if (typeof window !== 'undefined') {
    try { runtimeApiUrl = window.localStorage.getItem('physiquequest-runtime-api-url') ?? undefined; }
    catch { runtimeApiUrl = undefined; }
    pageLocation = { protocol: window.location.protocol, hostname: window.location.hostname };
  }
  const baseUrl = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, runtimeApiUrl, pageLocation);
  if (!baseUrl) throw new Error('The API address is invalid or unavailable. Check the app connection settings.');
  return baseUrl;
}

/**
 * An error body as the backend returns it. `message` is an array for Nest's own
 * validation rejections and a string for AppError.
 */
export interface ApiError {
  message?: string | string[];
  statusCode?: number;
  error?: string;
  /** Machine-readable code, present on AppError responses such as UPSTREAM_TIMEOUT. */
  code?: string;
}

/**
 * Reads the error body, which arrives in two different shapes:
 *
 * - AppError, which the global filter wraps as `{ error: { code, message, ... } }`
 * - Nest's own rejections, which stay flat as `{ statusCode, message: [...], error }`
 *
 * Only the first shape hides the payload under `error`, and unwrapping it is what
 * keeps a real message and code from degrading to a generic fallback.
 */
function readErrorBody(body: unknown): ApiError {
  if (!body || typeof body !== 'object') return {};
  const record = body as Record<string, unknown>;
  const nested = record.error;
  if (nested && typeof nested === 'object') return nested as ApiError;
  return record as ApiError;
}

export interface ExerciseRecord {
  _id: string; slug?: string; name: string; group?: string; targetMuscle?: string; equipment?: string;
  difficulty?: string; pictureUrl?: string; videoUrl?: string; instructions?: string[];
  trackingStatus?: string; pose?: 'missing' | 'ready' | 'training';
  gifUrl?: string; description?: string; checks?: string[]; recommended?: string; source?: string;
}
export interface ExerciseCatalog { items: ExerciseRecord[]; total: number; page: number; limit: number; pages: number; source?: string; coverageNote?: string; }
export interface ProgressRecord { _id: string; metric: 'weight' | 'waist' | 'benchPress'; value: number; unit: string; date?: string; measuredAt?: string; }
export interface WorkoutExerciseSnapshot { exerciseId: string; name: string; equipment: string; prescription?: string; sets: number; }
export interface WorkoutSetResult { setId: string; exerciseId: string; setIndex: number; reps: number; durationSeconds?: number; loadKg?: number; status: 'completed' | 'skipped'; source: 'manual' | 'local-video'; }
export interface WorkoutSessionRecord { _id: string; exerciseIds: string[]; exercises?: WorkoutExerciseSnapshot[]; revision?: number; startedAt: string; endedAt?: string; pausedAt?: string; pausedSeconds?: number; durationSeconds?: number; status: 'active' | 'completed'; exerciseResults?: { exerciseId: string; reps: number; loadKg?: number }[]; sets?: WorkoutSetResult[]; }
export type AlertRecord = {
  _id?: string;
  id?: string;
  eventType: 'manual' | 'inactivity' | 'cancelled';
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  errorCode?: string;
  resolvedAt?: string | null;
  flagged?: boolean;
};

export type PoseAnalysisInput = {
  mediaBase64: string;
  mimeType: 'video/mp4' | 'video/quicktime' | 'image/jpeg' | 'image/png';
  analysisType?: 'workout' | 'readiness';
  requestedChecks?: ('fullBodyInFrame' | 'lighting' | 'distance')[];
  durationSeconds?: number;
};

export type AdminAlertRow = {
  id: string;
  userName: string;
  eventType: 'manual' | 'inactivity' | 'cancelled';
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
  errorCode: string | null;
  occurredAt: string;
  resolvedAt: string | null;
  flagged: boolean;
  exerciseId: string | null;
  locationShared: boolean;
};

export type LeaderboardPeriod = 'week' | 'month' | 'all';

export interface LeaderboardEntryRecord {
  userId: string;
  name: string;
  points: number;
  rank: number;
  movement: number | 'same';
  isCurrentUser: boolean;
}

export interface LeaderboardRecord {
  period: LeaderboardPeriod;
  entries: LeaderboardEntryRecord[];
  self: LeaderboardEntryRecord;
  context: { previousName: string; pointsBehind: number } | null;
}

export interface CoachExercise {
  exerciseId: string;
  name: string;
  group: string;
  targetMuscle: string;
  equipment: string;
  tracking: 'AI tracked' | 'Manual';
  prescription?: string;
  formTip?: string | null;
}

export interface CoachDay {
  label: string;
  name: string;
  index: number;
  isWorkoutDay: boolean;
  title: string;
  focus: string | null;
  exercises: CoachExercise[];
  equipmentLabel?: string;
  formTip?: { exerciseName: string; text: string } | null;
  availabilityNote?: string | null;
}

export interface CoachPlanRecord {
  goal: string;
  weekLabel: string;
  sessionCount: number;
  duration: string;
  libraryReady: boolean;
  sets: string;
  days: CoachDay[];
}

export interface AdminAnalyticsRecord {
  rangeDays: 7 | 30 | 90;
  generatedAt: string;
  usersTotal: number;
  activeUsers: number | null;
  completedSessions: number;
  formScore: number | null;
  missionCompletion: number | null;
  weeklyRetention: number[] | null;
  emergencyEvents: { total: number; delivered: number; failed: number; pending: number };
}

/** Per-100 g macros, as reported alongside a scanned item. Informational only. */
export interface ScannedMacros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface FoodCandidate {
  fdc_id: number;
  description: string;
  data_type: string;
}

export interface FoodDetail {
  request_id: string;
  fdc_id: number;
  description: string;
  data_type: string;
  per_100g: ScannedMacros;
  serving_size_g?: number;
}

/**
 * One item detected by POST /api/nutrition/scan.
 *
 * Field names are snake_case to match that response, and
 * POST /api/nutrition/meals/from-scan validates exactly these keys, so a
 * detected item can be posted back without remapping it.
 */
export interface ScannedItem {
  food_name: string;
  /** False when no USDA record matched. The backend skips such items on save. */
  found: boolean;
  fdc_id?: number;
  description?: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  est_weight_g: number;
  confidence: number;
  per_100g?: ScannedMacros;
}

export interface ScanAnalysis {
  request_id: string;
  model: string;
  items: ScannedItem[];
  unmatched: string[];
  totals: ScannedMacros;
  /** True when some USDA lookups failed and macros may be incomplete. */
  degraded: boolean;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly error?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * How long the app waits for a scan result before abandoning it and offering a
 * retry. Deliberately far above the server's own deadline (25s) and above its
 * 20s cap on any single vision call: the server should always answer with a real
 * reason first, and this exists only to stop a dropped connection from leaving
 * the screen waiting forever.
 */
export const SCAN_TIMEOUT_MS = 60_000;

type RequestOptions = RequestInit & { timeoutMs?: number };

/**
 * Raised when the caller gave up waiting, as opposed to the server having
 * answered with a rejection. The distinction matters to the caller: a timeout
 * is worth retrying unchanged, whereas a 503 or a quota error usually is not.
 */
export class ApiTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`The request took longer than ${Math.round(timeoutMs / 1000)} seconds.`);
    this.name = 'ApiTimeoutError';
  }
}

export interface PasswordRecoveryRequest {
  accepted: boolean;
  requestId: string;
  delivery: 'queued' | 'unavailable';
  email?: string;
  code?: string;
  reason?: string;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    baseUrl?: string
  ): Promise<T> {
    const requestBaseUrl = baseUrl ?? getApiBaseUrl();
    const url = `${requestBaseUrl}${endpoint}`;

    const { timeoutMs, ...init } = options;
    const config: RequestInit = {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    };

    // Opt-in per request: only the long-running vision call gets a cap, so no
    // existing caller changes behaviour and quick writes cannot be cut short.
    // Resolved once so the abort and the reported timeout can never disagree.
    const cap = timeoutMs ?? 0;
    const controller = cap > 0 ? new AbortController() : null;
    let timedOut = false;
    const timer = controller
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, cap)
      : null;
    if (controller) config.signal = controller.signal;

    // Add auth token if available
    const token = this.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = readErrorBody(await response.json().catch(() => null));
        if (response.status === 401 && token === this.getToken() && requestBaseUrl === (baseUrl ?? getApiBaseUrl())) clearAuthSession();
        const raw = error.message;
        const message =
          (Array.isArray(raw) ? raw.join(', ') : raw?.trim()) ||
          `Request failed (${response.status})`;
        throw new ApiRequestError(message, response.status, error.code);
      }

      const result = await response.json();
      if (token && token === this.getToken() && requestBaseUrl === (baseUrl ?? getApiBaseUrl()) && config.method && config.method !== 'GET') {
        if (endpoint === '/profile') {
          if (config.method === 'DELETE') deviceCache.invalidate('profile');
          else deviceCache.publish('profile', result);
          deviceCache.invalidate('coach');
        }
        if (endpoint === '/nutrition/water' || /^\/nutrition\/meals(?:\/|$)/.test(endpoint)) {
          deviceCache.publish('nutrition', result);
          deviceCache.invalidate('activity');
        }
        if (endpoint.startsWith('/workouts')) deviceCache.invalidate('activity');
        if (endpoint === '/settings') deviceCache.invalidate('coach');
      }
      return result;
    } catch (error) {
      // HTTP rejections are expected application responses (for example, an
      // already-registered email). Keep those for the caller to handle without
      // reporting them as network failures; log transport and server failures.
      if (!(error instanceof ApiRequestError) || error.statusCode >= 500) {
        console.error('Network/API error:', error instanceof Error ? error.message : String(error));
      }
      // Only report a timeout when our own timer fired; otherwise throw the real error
      if (timedOut) throw new ApiTimeoutError(cap);
      if (error instanceof Error) throw error;
      throw new Error('Network error occurred');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const authData = localStorage.getItem('physiquequest-auth');
    if (!authData) return null;
    try {
      const parsed = JSON.parse(authData);
      return parsed.token || null;
    } catch {
      return null;
    }
  }

  // Auth endpoints
  async register(data: {
    name: string;
    email: string;
    password: string;
  }) {
    return this.request<{
      user: { id: string; name: string; email: string };
      access_token: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      user: { id: string; name: string; email: string };
      access_token: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Profile endpoints
  async createProfile(data: unknown) {
    return this.request<any>('/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProfile(force = false) {
    return deviceCache.fetch('profile', () => this.request<any>('/profile', {
      method: 'GET',
      timeoutMs: 15_000,
    }), force);
  }

  async updateProfile(data: unknown) {
    return this.request<any>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getNutrition(force = false) { return deviceCache.fetch('nutrition', () => this.request<any>('/nutrition', { timeoutMs: 15_000 }), force); }
  async addMeal(data: unknown) { return this.request<any>('/nutrition/meals', { method: 'POST', body: JSON.stringify(data) }); }
  async updateMeal(id: string, data: unknown) { return this.request<any>(`/nutrition/meals/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteMeal(id: string) { return this.request<any>(`/nutrition/meals/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async setWater(data: { date: string; glasses: number }) { return this.request<any>('/nutrition/water', { method: 'PUT', body: JSON.stringify(data) }); }
  async getSettings() { return this.request<any>('/settings'); }
  async updateSettings(values: Record<string, unknown>) { return this.request<any>('/settings', { method: 'PUT', body: JSON.stringify({ values }) }); }
  async getActivity(force = false) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return deviceCache.fetch('activity', () => this.request<any>(`/activity/state?timezone=${encodeURIComponent(timezone)}`, { timeoutMs: 15_000 }), force);
  }
  async updateActivity(state: Record<string, unknown>) { return this.request<any>('/activity/state', { method: 'PUT', body: JSON.stringify({ state }) }); }
  async getLeaderboard(period: LeaderboardPeriod = 'week') { return this.request<LeaderboardRecord>(`/leaderboard?period=${encodeURIComponent(period)}`); }
  async getCoachPlan(force = false) { return deviceCache.fetch('coach', () => this.request<CoachPlanRecord>('/coach/plan', { timeoutMs: 30_000 }), force); }
  async preloadAppData(force = false) {
    return Promise.allSettled([this.getProfile(force), this.getNutrition(force), this.getActivity(force), this.getCoachPlan(force)]);
  }
  async getNotifications() { return this.request<any>('/notifications'); }
  async markNotification(id: string, unread: boolean) { return this.request<any>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: JSON.stringify({ unread }) }); }
  async markAllNotifications() { return this.request<any>('/notifications/read-all', { method: 'POST' }); }

  async getAuthMe() { return this.request<{ id: string; email: string; role: 'user' | 'admin' }>('/auth/me'); }
  async requestPasswordReset(email: string) {
    return this.request<PasswordRecoveryRequest>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
  async verifyPasswordResetCode(requestId: string, code: string) {
    return this.request<{ verified: boolean; resetToken: string }>('/auth/password-reset/verify', {
      method: 'POST',
      body: JSON.stringify({ requestId, code }),
    });
  }
  async confirmPasswordReset(data: { resetToken: string; password: string }) {
    return this.request<{ updated: boolean }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async requestPasswordChange() {
    return this.request<PasswordRecoveryRequest>('/auth/password-change/request', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
  async verifyPasswordChange(requestId: string, code: string) {
    return this.request<{ verified: boolean; resetToken: string }>('/auth/password-change/verify', {
      method: 'POST',
      body: JSON.stringify({ requestId, code }),
    });
  }
  async confirmPasswordChange(data: { resetToken: string; password: string }) {
    return this.request<{ updated: boolean }>('/auth/password-change/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProgress(metric: string, limit = 90) { return this.request<any>(`/progress?metric=${encodeURIComponent(metric)}&limit=${limit}`); }
  async addProgress(data: any) { return this.request<any>('/progress', { method: 'POST', body: JSON.stringify(data) }); }
  async deleteProgress(id: string) { return this.request<any>(`/progress/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async getWorkouts(limit = 20) { return this.request<WorkoutSessionRecord[]>(`/workouts?limit=${encodeURIComponent(limit)}`); }
  async getActiveWorkout() { return this.request<WorkoutSessionRecord | null>('/workouts/active', { cache: 'no-store' }); }
  async getWorkout(id: string) { return this.request<WorkoutSessionRecord>(`/workouts/${encodeURIComponent(id)}`, { cache: 'no-store' }); }
  async saveWorkoutSet(id: string, expectedRevision: number, result: WorkoutSetResult) { return this.request<WorkoutSessionRecord>(`/workouts/${encodeURIComponent(id)}/sets`, { method: 'PATCH', body: JSON.stringify({ expectedRevision, result }) }); }
  async createWorkout(data: any) { return this.request<any>('/workouts', { method: 'POST', body: JSON.stringify(data) }); }
  async getAdminExercises() { return this.request<any[]>('/admin/exercises'); }
  async createAdminExercise(data: any) { return this.request<any>('/admin/exercises', { method: 'POST', body: JSON.stringify(data) }); }
  async updateAdminExercise(id: string, data: Record<string, unknown>) { return this.request<any>(`/admin/exercises/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteAdminExercise(id: string) { return this.request<any>(`/admin/exercises/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async getAdminAnalytics(days: 7 | 30 | 90) { return this.request<AdminAnalyticsRecord>(`/admin/analytics?days=${days}`); }
  async sendSafetyAlert(idempotencyKey: string) {
    return this.request<AlertRecord>('/safety/alerts', {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey, eventType: 'manual' }),
    });
  }

  /** Sends an inactivity alert, a cancelled-countdown record, or a location-bearing alarm. */
  async sendInactivityEvent(payload: {
    idempotencyKey: string;
    eventType: 'inactivity' | 'cancelled';
    location?: { lat: number; lng: number; accuracyMeters: number; capturedAt: string };
    workoutSessionId?: string;
    exerciseId?: string;
  }) {
    return this.request<AlertRecord>('/safety/alerts', { method: 'POST', body: JSON.stringify(payload) });
  }

  async resolveSafetyAlert(id: string) {
    return this.request<AlertRecord>(`/safety/alerts/${encodeURIComponent(id)}/resolve`, { method: 'POST' });
  }

  async getAdminAlerts(days: 7 | 30 | 90, status?: string) {
    const qs = new URLSearchParams({ days: String(days) });
    if (status) qs.set('status', status);
    return this.request<AdminAlertRow[]>(`/admin/alerts?${qs.toString()}`);
  }

  async getExercises(query?: { search?: string; muscle?: string; equipment?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (query?.search) qs.set('search', query.search);
    if (query?.muscle) qs.set('muscle', query.muscle);
    if (query?.equipment) qs.set('equipment', query.equipment);
    if (query?.page) qs.set('page', String(query.page));
    qs.set('limit', String(query?.limit ?? 12));
    return this.request<ExerciseCatalog>(`/exercises?${qs.toString()}`, { timeoutMs: 60_000 }, getCoachApiBaseUrl());
  }
  async getExercise(slug: string) { return this.request<ExerciseRecord>(`/exercises/${encodeURIComponent(slug)}`, { timeoutMs: 30_000 }, getCoachApiBaseUrl()); }
  async getIndependentCoachPlan(profile: Record<string, unknown>) {
    const { goal, days, duration, equipment, conditions, createdAt } = profile;
    return this.request<CoachPlanRecord>('/coach/plan', { method: 'POST', timeoutMs: 60_000, body: JSON.stringify({ profile: { goal, days, duration, equipment, conditions, createdAt } }) }, getCoachApiBaseUrl());
  }

  // Food scanning
  /**
   * Sends a base64 photo for server-side vision analysis.
   *
   * The body must be JSON: the backend rejects any other content type, and the
   * image travels inline rather than as multipart because the server needs the
   * bytes to forward to the vision provider.
   */
  async analyzeImage(
    image: { base64: string; mimeType: string },
    timeoutMs: number = SCAN_TIMEOUT_MS
  ) {
    return this.request<ScanAnalysis>('/nutrition/scan', {
      method: 'POST',
      timeoutMs,
      body: JSON.stringify({ image: image.base64, mimeType: image.mimeType }),
    });
  }

  async searchFoods(query: string) {
    return this.request<{ request_id: string; candidates: FoodCandidate[] }>(`/nutrition/foods/search?q=${encodeURIComponent(query)}`);
  }

  async getFoodDetail(fdcId: number) {
    return this.request<FoodDetail>(`/nutrition/foods/${encodeURIComponent(fdcId)}`);
  }

  async getPoseStatus() { return this.request<any>('/pose/status'); }
  async analyzePose(data: PoseAnalysisInput) { return this.request<unknown>('/pose/analyze', { method: 'POST', body: JSON.stringify(data), timeoutMs: 60000 }); }
  async pauseWorkout(id: string, data: any) { return this.request<any>(`/workouts/${encodeURIComponent(id)}/pause`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async completeWorkout(id: string, data: any) { return this.request<any>(`/workouts/${encodeURIComponent(id)}/complete`, { method: 'POST', body: JSON.stringify(data) }); }

  /** Writes one meal row per item that carries a USDA match. */
  async addMealsFromScan(data: { items: ScannedItem[]; meal: string; date?: string; time?: string }) {
    return this.request<any>('/nutrition/meals/from-scan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
