import { changeJournal, journals, recordAction, workoutHistorySnapshot } from './workoutJournal';
// API client configuration
import { appVersionHeaders, clearAuthSession, session } from './session';
import { resolveApiBaseUrl } from './apiBaseUrl.mjs';
import { resolveCoachBaseUrl } from './coachBaseUrl.mjs';
import { createDeviceCache } from './deviceCache.mjs';
import { ApiNetworkError, friendlyRequestMessage, normalizeTransportError } from './apiErrors.mjs';
import { announceDataChange } from './dataChanges.mjs';

export const deviceCache = createDeviceCache({
  context: () => {
    if (typeof window === 'undefined') return null;
    try {
      const user = session.current(getApiBaseUrl());
      return user?.id && (user.token || user.offlineOnly) ? { scope: `${getApiBaseUrl()}:${user.id}`, session: String(user.sessionKey) } : null;
    } catch { return null; }
  },
  storage: () => typeof window === 'undefined' ? undefined : window.localStorage,
  validate: (key, data) => {
    if (!data || typeof data !== 'object') return false;
    if (key === 'profile') return typeof data.name === 'string';
    if (key === 'settings') return !!data.values && typeof data.values === 'object' && !Array.isArray(data.values);
    if (key === 'coach') return Array.isArray(data.days) && data.days.every((day: any) => day && Array.isArray(day.exercises));
    if (key === 'nutrition') return Array.isArray(data.meals) && Array.isArray(data.water);
    if (key === 'notifications') return Array.isArray(data.items);
    if (key === 'workouts' || key.startsWith('progress:')) return Array.isArray(data);
    if (key === 'saved-programs') return Array.isArray(data.items) && data.items.every((item: any) => item && typeof item.id === 'string' && Array.isArray(item.days));
    if (key === 'workout-summary') return Array.isArray(data.trainingDates) && Array.isArray(data.personalRecords);
    if (key === 'exercise-library') return (typeof data.query === 'string' && Array.isArray(data.result?.items)) || (data.queries && typeof data.queries === 'object' && data.details && typeof data.details === 'object');
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
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_PQ_ADMIN_GATEWAY === '1' && window.location.pathname.startsWith('/admin')) {
    return `${window.location.origin}/api`;
  }
  let runtimeApiUrl: string | undefined;
    let pageLocation: { protocol: string; hostname: string; port?: string } | undefined;
  if (typeof window !== 'undefined') {
    try { runtimeApiUrl = window.localStorage.getItem('physiquequest-runtime-api-url') ?? undefined; }
    catch { runtimeApiUrl = undefined; }
    pageLocation = { protocol: window.location.protocol, hostname: window.location.hostname, port: window.location.port };
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
  bodyParts?: string[]; equipments?: string[]; targetMuscles?: string[]; secondaryMuscles?: string[];
}
export interface ExerciseCatalog { items: ExerciseRecord[]; total: number; page: number; limit: number; pages: number; source?: string; coverageNote?: string; }
export type ExerciseDiscoveryQuery = { search?: string; muscle?: string; equipment?: string; bodyPart?: string; target?: string; secondary?: string; sort?: 'name-asc' | 'name-desc' | 'body-part' | 'equipment'; page?: number; limit?: number };
export type ExerciseFilters = { bodyParts: string[]; equipments: string[]; targetMuscles: string[]; secondaryMuscles: string[] };
export interface ProgressRecord { _id: string; metric: 'weight' | 'chest' | 'waist' | 'arms' | 'benchPress'; value: number; unit: string; date?: string; measuredAt?: string; }
export interface WorkoutExerciseSnapshot { exerciseId: string; name: string; equipment: string; prescription?: string; sets: number; restBetweenSets?: number; restAfterExercise?: number; }
export interface WorkoutSetResult { setId: string; exerciseId: string; setIndex: number; reps: number; durationSeconds?: number; loadKg?: number; loadValue?: number; loadUnit?: 'kg' | 'lbs'; barWeightKg?: number; status: 'completed' | 'skipped'; source: 'manual' | 'local-video'; setType?: 'normal' | 'warmup' | 'drop' | 'failure'; }
export interface WorkoutSessionRecord { routineName?: string; _id: string; exerciseIds: string[]; exercises?: WorkoutExerciseSnapshot[]; dayIndex?: number; scheduledDate?: string; origin?: 'planned' | 'standalone' | 'recorded-set'; revision?: number; startedAt: string; endedAt?: string; timezone?: string; pausedAt?: string; pausedSeconds?: number; durationSeconds?: number; status: 'active' | 'completed'; exerciseResults?: { exerciseId: string; reps: number; loadKg?: number }[]; sets?: WorkoutSetResult[]; }
export type WorkoutSummary = { trainingDates: string[]; personalRecords: { exerciseId: string; name: string; loadKg?: number; loadValue?: number; loadUnit?: 'kg' | 'lbs'; volumeKg?: number; volumeDate?: string; date: string }[] };
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
  exerciseHint?: 'chest_press' | 'squat';
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
export type StrengthStanding = { userId: string; name: string; rank: number; score: number; maxKg: number; loadKg: number; reps: number; bodyweightKg?: number; isCurrentUser: boolean };
export type StrengthLeaderboardRecord = { exercises: { id: string; name: string }[]; exerciseId: string | null; metric: 'heaviest' | 'relative'; entries: StrengthStanding[]; participants?: { userId: string; name: string; isCurrentUser: boolean }[]; self: StrengthStanding | null; hidden: boolean };

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
  /** Adjustment and tip from this exercise's latest workout feedback; the exercise itself never changes. */
  feedbackTip?: string | null;
  formTip?: string | null;
  /** Rest in seconds, applied to the session when it starts from a saved program. */
  restBetweenSets?: number;
  restAfterExercise?: number;
}

/** `loadBase` ("Bar", "EZ bar") means `weight` is plates added to that bar, shown as "Bar + 25 kg". */
export interface ProgramExercise { exerciseId: string; name: string; targetMuscle: string; equipment: string; sets: number; reps?: string; weight?: number; loadBase?: string; unit: 'kg' | 'lbs'; restSets: number; restNext: number; }
export interface ProgramDay { id: string; title: string; weekday?: number; exercises: ProgramExercise[]; }
export interface SavedProgram { id: string; name: string; notes?: string; source: 'custom' | 'split' | 'athlete'; templateId?: string; days: ProgramDay[]; updatedAt?: string; }

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
  programVersion?: string;
  goal: string;
  weekLabel: string;
  ageNote?: string | null;
  intensity?: 'starter' | 'building' | 'advanced';
  intensityNote?: string | null;
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
  newUsers?: number;
  activeUsers: number | null;
  completedSessions: number;
  formScore: number | null;
  missionCompletion: number | null;
  weeklyRetention: number[] | null;
  emergencyEvents: { total: number; delivered: number; failed: number; pending: number };
  trend?: { date: string; newUsers: number; activeUsers: number; workouts: number }[];
  appFeedback?: { count: number; pending?: number; averageRating: number | null; recent: { rating: number; category: string; message: string; platform: string | null; createdAt: string }[] };
}

/** Per-100 g macros, as reported alongside a scanned item. Informational only. */
export interface ScannedMacros {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface FoodCandidate {
  fdc_id: number;
  id?: string;
  source?: string;
  description: string;
  data_type: string;
}

export interface FoodDetail {
  request_id: string;
  fdc_id: number;
  id?: string;
  source?: string;
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
  nutrition_ref?: string;
  nutrition_source?: string;
  reference_ingredients?: string[];
  description?: string;
  portionDescription?: string;
  evidence?: { name: FoodEvidence; quantity: FoodEvidence; preparation: FoodEvidence; added_oil: FoodEvidence };
  evidence_ref?: string;
  preparation_correction?: string;
  added_oil_correction?: string;
  entered_quantity?: number;
  entered_unit?: 'g' | 'kg' | 'oz' | 'lb';
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  est_weight_g: number;
  confidence: number;
  per_100g?: ScannedMacros;
  identification_method?: 'ai' | 'manual' | 'corrected';
  weight_corrected?: boolean;
  portion_method?: 'visual_estimate';
  portion_confidence?: null;
  region_confidence?: null;
  weight_min_g?: null;
  weight_max_g?: null;
}

export type FoodEvidence = 'user_confirmed' | 'visually_identified' | 'estimated' | 'unknown';

export interface ScanAnalysis {
  request_id: string;
  items: ScannedItem[];
  unmatched: string[];
  totals: { [K in keyof ScannedMacros]: number | null };
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
 * retry. Deliberately far above the server's own deadline (90s) and above its
 * 60s cap on any single vision call: the server should always answer with a real
 * reason first, and this exists only to stop a dropped connection from leaving
 * the screen waiting forever.
 */
export const SCAN_TIMEOUT_MS = 110_000;

type RequestOptions = RequestInit & { timeoutMs?: number };

/**
 * Raised when the caller gave up waiting, as opposed to the server having
 * answered with a rejection. The distinction matters to the caller: a timeout
 * is worth retrying unchanged, whereas a 503 or a quota error usually is not.
 */
/** Requests still running after this long count as slow; the app shell shows a slow-connection notice. */
export const SLOW_REQUEST_MS = 6000;
let slowRequests = 0;
function reportSlow(delta: 1 | -1) {
  slowRequests = Math.max(0, slowRequests + delta);
  window.dispatchEvent(new CustomEvent('physiquequest:slow-network', { detail: slowRequests }));
}

export class ApiTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super('This is taking longer than expected. Please try again.');
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
    const ownApi = requestBaseUrl === getApiBaseUrl();

    const { timeoutMs, ...init } = options;
    const config: RequestInit = {
      ...init,
      credentials: ownApi ? 'include' : 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...(ownApi ? appVersionHeaders() : {}),
        ...init.headers,
      },
    };

    if (init.signal?.aborted) throw init.signal.reason ?? new Error('Request cancelled');
    const isAuth = endpoint.startsWith('/auth/session/') || endpoint.startsWith('/auth/password-reset/');
    const existing = session.current(requestBaseUrl);
    if (existing?.offlineOnly && !isAuth) throw new ApiNetworkError();
    if (ownApi && !isAuth && existing && existing.expiresAt <= Date.now() + 30_000) {
      const refreshed = await session.refresh(requestBaseUrl);
      if (!refreshed || refreshed.id !== existing.id || refreshed.sessionKey !== existing.sessionKey || requestBaseUrl !== getApiBaseUrl()) {
        if (!session.current(requestBaseUrl)) clearAuthSession();
        throw new ApiRequestError('Session expired. Sign in again.', 401);
      }
    }

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
    const externalSignal = init.signal;
    const forwardAbort = () => controller?.abort(externalSignal?.reason);
    if (controller) {
      config.signal = controller.signal;
      if (externalSignal?.aborted) forwardAbort();
      else externalSignal?.addEventListener('abort', forwardAbort, { once: true });
    }

    // Add auth token if available
    let token = ownApi ? this.getToken() : null;
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    // Chat and capped calls (photo scans) show their own progress; everything else reports when it is slow.
    let slow = false;
    const slowTimer = ownApi && !cap && endpoint !== '/chat' && typeof window !== 'undefined' ? setTimeout(() => { slow = true; reportSlow(1); }, SLOW_REQUEST_MS) : null;
    try {
      if (config.signal?.aborted) throw config.signal.reason ?? new Error('Request cancelled');
      let response = await fetch(url, config);
      if (ownApi && (!config.method || config.method === 'GET') && (endpoint === '/profile' || endpoint === '/nutrition') && response.status >= 500 && !timedOut) {
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!timedOut) response = await fetch(url, config);
      }
      if (response.status === 401 && !config.signal?.aborted && ownApi && !isAuth && token && existing?.id === session.current(requestBaseUrl)?.id && existing?.sessionKey === session.current(requestBaseUrl)?.sessionKey && requestBaseUrl === getApiBaseUrl()) {
        const current = session.current(requestBaseUrl);
        const refreshed = current?.token !== token ? current : await session.refresh(requestBaseUrl);
        if (refreshed && !config.signal?.aborted && refreshed.id === existing?.id && refreshed.sessionKey === existing?.sessionKey && requestBaseUrl === getApiBaseUrl()) {
          token = refreshed.token;
          config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
          response = await fetch(url, config);
        } else if (!session.current(requestBaseUrl)) clearAuthSession();
      }

      if (!response.ok) {
        const error = readErrorBody(await response.json().catch(() => null));
        if (response.status === 401 && token === this.getToken() && requestBaseUrl === (baseUrl ?? getApiBaseUrl())) clearAuthSession();
        const raw = error.message;
        const message = endpoint === '/auth/registration-code/request' && response.status === 503
          ? 'We couldn’t send your verification code right now. Please try again later.'
          : friendlyRequestMessage(response.status, raw);
        throw new ApiRequestError(message, response.status, error.code);
      }

      const result = await response.json();
      if (ownApi && token && typeof window !== 'undefined') window.dispatchEvent(new Event('physiquequest:connection-restored'));
      if (token && token === this.getToken() && requestBaseUrl === (baseUrl ?? getApiBaseUrl()) && config.method && config.method !== 'GET') {
        const changed: string[] = [];
        if (endpoint === '/profile') {
          if (config.method === 'DELETE') deviceCache.invalidate('profile');
          else deviceCache.publish('profile', result);
          deviceCache.invalidate('coach');
          changed.push('profile', 'coach');
        }
        if (endpoint === '/nutrition/water' || endpoint === '/nutrition/plan' || /^\/nutrition\/meals(?:\/|$)/.test(endpoint)) {
          deviceCache.publish('nutrition', result);
          deviceCache.invalidate('activity');
          changed.push('nutrition', 'activity');
        }
        if (endpoint.startsWith('/workouts')) { deviceCache.invalidate('activity'); deviceCache.invalidate('workouts'); deviceCache.invalidate('workout-summary'); changed.push('activity', 'workouts', 'workout-summary'); if (endpoint.endsWith('/complete')) { deviceCache.invalidate('notifications'); changed.push('notifications'); } }
        if (endpoint.startsWith('/progress')) for (const metric of ['weight', 'chest', 'waist', 'arms', 'benchPress'] as const) { deviceCache.invalidate(`progress:${metric}`); changed.push(`progress:${metric}`); }
        if (endpoint === '/feedback') { deviceCache.invalidate('coach'); changed.push('coach'); }
        if (endpoint === '/settings') { deviceCache.invalidate('coach'); changed.push('coach', 'settings'); }
        if (endpoint.startsWith('/admin/exercises')) { deviceCache.invalidate('exercise-library'); changed.push('exercise-library'); }
        if (endpoint.startsWith('/notifications/')) { deviceCache.publish('notifications', result); changed.push('notifications'); }
        if (endpoint === '/profile/photo') changed.push('profile');
        if (endpoint === '/coach/plan/day') changed.push('coach');
        if (endpoint.startsWith('/coach/programs/')) { deviceCache.publish('saved-programs', result); changed.push('saved-programs'); }
        const owner = session.current(requestBaseUrl);
        if (owner?.id) announceDataChange(`${requestBaseUrl}:${owner.id}`, changed);
      }
      return result;
    } catch (error) {
      if (externalSignal?.aborted && !timedOut) throw externalSignal.reason ?? error;
      const failure = normalizeTransportError(error);
      if (ownApi && token && typeof window !== 'undefined' && (timedOut || failure instanceof ApiNetworkError)) window.dispatchEvent(new Event('physiquequest:connection-lost'));
      // HTTP rejections are expected application responses (for example, an
      // already-registered email). Keep those for the caller to handle without
      // reporting them as network failures; log transport and server failures.
      if (failure instanceof ApiNetworkError) {
        console.warn('API connection failed:', endpoint.split('?')[0], failure.message);
      } else if (error instanceof ApiRequestError && error.statusCode >= 500) {
        console.warn('API request failed:', endpoint.split('?')[0], error.message);
      } else if (!(error instanceof ApiRequestError)) {
        console.error('Network/API error:', endpoint.split('?')[0], error instanceof Error ? error.message : String(error));
      }
      // Only report a timeout when our own timer fired; otherwise throw the real error
      if (timedOut) throw new ApiTimeoutError(cap);
      if (failure instanceof Error) throw failure;
      throw new Error('We couldn’t connect. Check your internet connection and try again.');
    } finally {
      if (timer) clearTimeout(timer);
      if (slowTimer) clearTimeout(slowTimer);
      if (slow) reportSlow(-1);
      externalSignal?.removeEventListener('abort', forwardAbort);
    }
  }

  private getToken(): string | null {
    return session.current(getApiBaseUrl())?.token ?? null;
  }

  // Auth endpoints
  async register(data: {
    name: string;
    email: string;
    password: string;
    requestId: string;
    code: string;
    profile: unknown;
  }) {
    return this.request<{
      user: { id: string; name: string; email: string };
      access_token: string;
      expires_in: number;
    }>('/auth/session/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async requestRegistrationCode(email: string) {
    return this.request<{ requestId: string }>('/auth/registration-code/request', { method: 'POST', body: JSON.stringify({ email }) });
  }
  async requestAccountVerificationCode() { return this.request<{ requestId: string }>('/auth/verification-code/request', { method: 'POST', body: '{}' }); }
  async confirmAccountVerificationCode(requestId: string, code: string) { return this.request<{ verified: boolean }>('/auth/verification-code/confirm', { method: 'POST', body: JSON.stringify({ requestId, code }) }); }

  async login(data: { email: string; password: string }) {
    return this.request<{
      user: { id: string; name: string; email: string };
      access_token: string;
      expires_in: number;
    }>('/auth/session/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adminLogin(data: { username: string; password: string }) {
    return this.request<{user: {id: string; name: string; email: string}; access_token: string; expires_in: number}>('/auth/session/admin-login', {method:'POST',body:JSON.stringify(data)});
  }

  async checkGoogleAccount(idToken: string, intent: 'login' | 'register') {
    return this.request<{ email: string; name: string; registered: boolean; needsProfile?: boolean }>('/auth/google/check', {
      method: 'POST',
      body: JSON.stringify({ idToken, intent }),
    });
  }

  async googleLogin(idToken: string) {
    return this.request<{
      user: { id: string; name: string; email: string };
      access_token: string;
      expires_in: number;
    }>('/auth/session/google/login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  async googleRegister(data: { idToken: string; password: string; requestId: string; code: string; name: string; profile: unknown }) {
    return this.request<{
      user: { id: string; name: string; email: string };
      access_token: string;
      expires_in: number;
    }>('/auth/session/google/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout() { return this.request('/auth/logout', { method: 'POST', body: '{}' }); }

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
  async setDietaryPlan(data: { goal: string; calories: number; protein: number; carbs: number; fat: number; activity?: string; startedAt?: string }) { return this.request<any>('/nutrition/plan', { method: 'PUT', body: JSON.stringify(data) }); }
  async recommendDietaryPlan() { return this.request<{ goal: string; calories: number; protein: number; carbs: number; fat: number }>('/nutrition/plan/recommend', { method: 'POST', body: '{}' }); }
  async addMeal(data: unknown) { return this.request<any>('/nutrition/meals', { method: 'POST', body: JSON.stringify(data) }); }
  async updateMeal(id: string, data: unknown) { return this.request<any>(`/nutrition/meals/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteMeal(id: string) { return this.request<any>(`/nutrition/meals/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async setWater(data: { date: string; glasses: number }) { return this.request<any>('/nutrition/water', { method: 'PUT', body: JSON.stringify(data) }); }
  async getSettings(force = false) { return deviceCache.fetch('settings', () => this.request<any>('/settings'), force); }
  async updateSettings(values: Record<string, unknown>) { const result = await this.request<any>('/settings', { method: 'PUT', body: JSON.stringify({ values }) }); deviceCache.publish('settings', result); return result; }
  async getActivity(force = false) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return deviceCache.fetch('activity', () => this.request<any>(`/activity/state?timezone=${encodeURIComponent(timezone)}`, { timeoutMs: 15_000 }), force);
  }
  async updateActivity(state: Record<string, unknown>) { return this.request<any>('/activity/state', { method: 'PUT', body: JSON.stringify({ state }) }); }
  async getLeaderboard(period: LeaderboardPeriod = 'week') { return this.request<LeaderboardRecord>(`/leaderboard?period=${encodeURIComponent(period)}`); }
  async getLeaderboardPhotos(ids: string[]) { return this.request<{ photos: Record<string, string> }>(`/leaderboard/photos?ids=${ids.map(encodeURIComponent).join(',')}`); }
  async getStrengthLeaderboard(exerciseId: string, metric: 'heaviest' | 'relative') { const params = new URLSearchParams({ metric }); if (exerciseId) params.set('exerciseId', exerciseId); return this.request<StrengthLeaderboardRecord>(`/leaderboard/strength?${params}`); }
  async saveProfilePhoto(photo: string | null) { const profile = await this.request<any>('/profile/photo', photo ? { method: 'PUT', body: JSON.stringify({ photo }) } : { method: 'DELETE' }); deviceCache.publish('profile', profile); return profile; }
  async chat(messages: { role: 'user' | 'assistant'; text: string }[], includePersonalData = false, page?: string, signal?: AbortSignal) {
    return this.request<{ reply: string; sources?: { id: string; label: string }[]; privacy: { personalDataIncluded: boolean; historyStored: false; provider: 'openai' } }>('/chat', { method: 'POST', body: JSON.stringify({ messages, includePersonalData, page }), timeoutMs: 60000, signal });
  }
  async getSavedPrograms(force = false) { return deviceCache.fetch('saved-programs', () => this.request<{ items: SavedProgram[] }>('/coach/programs'), force); }
  async saveProgram(program: SavedProgram) { const { updatedAt: _updatedAt, ...body } = program; return this.request<{ items: SavedProgram[] }>(`/coach/programs/${encodeURIComponent(program.id)}`, { method: 'PUT', body: JSON.stringify(body) }); }
  async deleteProgram(id: string) { return this.request<{ items: SavedProgram[] }>(`/coach/programs/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async getCoachPlan(force = false) { return deviceCache.fetch('coach', () => this.request<CoachPlanRecord>('/coach/plan', { timeoutMs: 30_000 }), force); }
  async checkEquipment(photo: string) {
    return this.request<{status: 'visible_damage' | 'inconclusive'}>('/coach/equipment-check', {
      method: 'POST', body: JSON.stringify({ photo, consent: true }), timeoutMs: 20000,
    });
  }
  async saveAppFeedback(input: { rating: number; category: 'bug' | 'idea' | 'praise' | 'other'; message: string }) {
    const native = typeof window !== 'undefined' && window.ReactNativeWebView ? (/iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'android') : 'web';
    const appVersion = appVersionHeaders()['X-App-Version'];
    await this.request('/feedback/app', { method: 'POST', body: JSON.stringify({ ...input, platform: native, ...(appVersion && { appVersion }) }) });
  }
  async saveWorkoutFeedback(input: { source: 'manual' | 'pose'; exercise: string; sessionRef?: string; rpe: number; difficulty: string; enjoyment?: number; painLocations: string[]; notes?: string }) {
    await this.request('/feedback', { method: 'POST', body: JSON.stringify(input) });
  }
  async getWorkoutAiSummary(id: string) {
    if (id.startsWith('local-')) {
      const row = (await journals(this.workoutOwner())).find(row => row.id === id);
      if (!row?.serverId || row.operations.length) throw new Error('Sync this workout before requesting an insight.');
      id = row.serverId;
    }
    return this.request<{ summary: string; suggestion: string }>(`/workouts/${encodeURIComponent(id)}/ai-summary`, { method: 'POST', timeoutMs: 25000 }); }
  async updateCoachDay(data: { programVersion: string; dayIndex: number; title: string; exercises: CoachExercise[] }) {
    const plan = await this.request<CoachPlanRecord>('/coach/plan/day', { method: 'PUT', body: JSON.stringify(data) });
    deviceCache.publish('coach', plan);
    return plan;
  }
  /** Replaces the whole weekly plan: listed days become these sessions, every other day a rest day. */
  async replaceCoachWeek(data: { programVersion: string; days: { dayIndex: number; title: string; exercises: CoachExercise[] }[] }) {
    const plan = await this.request<CoachPlanRecord>('/coach/plan/week', { method: 'PUT', body: JSON.stringify(data) });
    deviceCache.publish('coach', plan);
    return plan;
  }
  async preloadAppData(force = false) {
    return Promise.allSettled([this.getProfile(force), this.getSettings(force), this.getNutrition(force), this.getActivity(force), this.getCoachPlan(force), this.getAllWorkouts(force)]);
  }
  async getNotifications(force = false) { return deviceCache.fetch('notifications', () => this.request<any>('/notifications'), force); }
  async setNotificationReminder(reminder: { enabled: boolean; hour: number; minute: number; timezone: string }) { return this.request<any>('/notifications/reminder', { method: 'PUT', body: JSON.stringify(reminder) }); }
  async registerPushDevice(deviceId: string, token: string) { return this.request<{ registered: boolean; mode: string }>('/push/devices', { method: 'PUT', body: JSON.stringify({ deviceId, token }) }); }
  async revokePushDevice(deviceId: string) { return this.request('/push/devices/' + encodeURIComponent(deviceId), { method: 'DELETE' }); }
  async markNotification(id: string, unread: boolean) { return this.request<any>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: JSON.stringify({ unread }) }); }
  async markAllNotifications() { return this.request<any>('/notifications/read-all', { method: 'POST' }); }
  async clearNotifications(ids: string[]) { return this.request<any>('/notifications/clear', { method: 'POST', body: JSON.stringify({ ids }) }); }

  async getAuthMe() { return this.request<{ id: string; email: string; role: 'user' | 'admin'; mustChangePassword?: boolean }>('/auth/me'); }
  async changeInitialAdminPassword(currentPassword: string, newPassword: string) { return this.request<{updated: boolean}>('/auth/admin-initial-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); }
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

  async getProgress(metric: string, limit = 90, force = false) {
    const load = async () => {
      if (limit !== 365) return this.request<ProgressRecord[]>(`/progress?metric=${encodeURIComponent(metric)}&limit=${limit}`);
      const all: ProgressRecord[] = [];
      const seen = new Set<string>();
      for (;;) {
        const page = await this.request<ProgressRecord[]>(`/progress?metric=${encodeURIComponent(metric)}&limit=365&skip=${all.length}`);
        if (page.some(entry => seen.has(entry._id))) throw new Error('Could not load all measurement history. Please update the server and try again.');
        page.forEach(entry => seen.add(entry._id));
        all.push(...page);
        if (page.length < 365) return all;
      }
    };
    if (![90, 365].includes(limit) || !['weight', 'chest', 'waist', 'arms', 'benchPress'].includes(metric)) return load();
    return deviceCache.fetch(`progress:${metric}` as 'progress:weight' | 'progress:chest' | 'progress:waist' | 'progress:arms' | 'progress:benchPress', load, force);
  }
  async addProgress(data: any) { return this.request<any>('/progress', { method: 'POST', body: JSON.stringify(data) }); }
  async deleteProgress(id: string) { return this.request<any>(`/progress/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  private workoutOwner() {
    const base = getApiBaseUrl();
    const user = session.current(base);
    if (!user?.id || (!user.token && !user.offlineOnly)) throw new Error('Sign in to open saved workouts.');
    return JSON.stringify([base,user.id]);
  }
  async startManualWorkout(data: Parameters<typeof recordAction>[2] & {kind:'create'}) {
    const owner = this.workoutOwner();
    return recordAction(owner, 'local-' + data.data.requestKey, data);
  }
  async latestLocalReport() {
    return (await journals(this.workoutOwner())).filter(row => row.workout.status === 'completed')
      .sort((a,b) => b.workout.endedAt!.localeCompare(a.workout.endedAt!))[0]?.workout ?? null;
  }
  async workoutSyncStatus(id: string) {
    const row = (await journals(this.workoutOwner())).find(row => row.id === id);
    return row ? { pending:row.operations.length, error:row.error } : null;
  }
  private syncing = false;
  async syncManualWorkouts() {
    if (!session.current(getApiBaseUrl())?.token || this.syncing || typeof indexedDB === 'undefined' || !navigator.onLine) return;
    this.syncing = true;
    try {
      const owner = this.workoutOwner();
      for (const row of await journals(owner)) {
        if (row.workout.status !== 'completed') continue;
        let serverId = row.serverId;
        for (const operation of row.operations) {
          if (owner !== this.workoutOwner()) return;
          try {
            const create = operation.kind === 'create';
            if (!create && !serverId) throw new Error('Workout creation has not been confirmed.');
            const path = create ? '/workouts' : '/workouts/' + encodeURIComponent(serverId!) + '/' + operation.kind;
            const method = create || operation.kind === 'complete' ? 'POST' : 'PATCH';
            const saved = await this.request<WorkoutSessionRecord>(path,{method,body:JSON.stringify(operation.data),timeoutMs:15000});
            if (owner !== this.workoutOwner()) return;
            if (!saved?._id || (serverId && saved._id !== serverId) || saved.startedAt !== row.workout.startedAt ||
                (operation.kind === 'complete' && saved.status !== 'completed')) throw new Error('Unexpected workout confirmation.');
            if (operation.kind === 'sets' && !saved.sets?.some(set =>
              Object.entries(operation.data.result).every(([key,value]) => set[key as keyof WorkoutSetResult] === value))) throw new Error('Server did not confirm the recorded set.');
            if (operation.kind === 'pause' && Boolean(saved.pausedAt) !== operation.data.paused) throw new Error('Server did not confirm the pause state.');
            if (operation.kind === 'routine' && !operation.data.exercises.every((item,index) => saved.exercises?.[index]?.exerciseId === item.exerciseId)) throw new Error('Server did not confirm the exercise order.');
            if (operation.kind === 'complete' && (saved.endedAt !== operation.data.endedAt || saved.sets?.length !== row.workout.sets?.length)) throw new Error('Server returned a different completed workout.');
            serverId = saved._id;
            await changeJournal(owner,row.id,current => {
              if (!current || current.operations[0]?.id !== operation.id) throw new Error('Workout queue changed.');
              return {...current,serverId,operations:current.operations.slice(1),error:undefined,
                workout:operation.kind === 'complete' ? {...saved,_id:row.id} : current.workout};
            });
          } catch (error) {
            await changeJournal(owner,row.id,current => {
              if (!current) throw error;
              return {...current,attempts:current.attempts+1,error:error instanceof Error ? error.message : 'Synchronization failed.'};
            });
            break;
          }
        }
      }
    } finally { this.syncing = false; }
  }
  async getWorkouts(limit = 20, force = false) { if (limit === 20) return (await this.getAllWorkouts(force)).slice(0, limit); return this.request<WorkoutSessionRecord[]>(`/workouts?limit=${encodeURIComponent(limit)}`); }
  async getAllWorkouts(force = false) {
    const owner = this.workoutOwner();
    return deviceCache.fetch('workouts', async () => {
      const all: WorkoutSessionRecord[] = [];
      let before = '';
      try {
        for (;;) {
          if (!navigator.onLine) throw new ApiNetworkError();
          const page = await this.request<WorkoutSessionRecord[]>(`/workouts?limit=100${before ? `&before=${encodeURIComponent(before)}` : ''}`);
          if (owner !== this.workoutOwner()) throw new Error('Account changed.');
          all.push(...page);
          if (page.length < 100) break;
          const last = page[page.length - 1];
          const next = `${last.startedAt}|${last._id}`;
          if (next === before) throw new Error('Could not advance workout history.');
          before = next;
        }
        if (typeof indexedDB !== 'undefined') await workoutHistorySnapshot(owner,all);
      } catch (error) {
        if (!(error instanceof ApiNetworkError) || typeof indexedDB === 'undefined') throw error;
        all.splice(0,all.length,...await workoutHistorySnapshot(owner));
      }
      const local = typeof indexedDB === 'undefined' ? [] : await journals(owner);
      if (owner !== this.workoutOwner()) throw new Error('Account changed.');
      return [...local.map(row => row.workout), ...all.filter(item => !local.some(row => row.serverId === item._id))]
        .sort((a,b) => b.startedAt.localeCompare(a.startedAt));
    }, force);
  }
  async getWorkoutSummary(force = false) { const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; return deviceCache.fetch('workout-summary', () => this.request<WorkoutSummary>(`/workouts/summary?timezone=${encodeURIComponent(timezone)}`), force); }
  async getActiveWorkout() { const active = typeof indexedDB !== 'undefined' && (await journals(this.workoutOwner())).find(row => row.workout.status === 'active'); if (active) return active.workout; return this.request<WorkoutSessionRecord | null>('/workouts/active', { cache: 'no-store' }).catch(error => { if (error instanceof ApiNetworkError) return null; throw error; }); }
  async getWorkout(id: string) { if (id.startsWith('local-')) {
    const row = (await journals(this.workoutOwner())).find(row => row.id === id);
    if (!row) throw new Error('Saved workout unavailable.');
    return row.workout;
  } return this.request<WorkoutSessionRecord>(`/workouts/${encodeURIComponent(id)}`, { cache: 'no-store' }); }
  async saveWorkoutSet(id: string, expectedRevision: number, result: WorkoutSetResult) { if (id.startsWith('local-')) return recordAction(this.workoutOwner(),id,{kind:'sets',data:{expectedRevision,result}}); return this.request<WorkoutSessionRecord>(`/workouts/${encodeURIComponent(id)}/sets`, { method: 'PATCH', body: JSON.stringify({ expectedRevision, result }) }); }
  async updateWorkoutRoutine(id: string, expectedRevision: number, exercises: { exerciseId: string; restBetweenSets: number; restAfterExercise: number; name?: string; equipment?: string; prescription?: string; sets?: number }[], routineName?: string) { if (id.startsWith('local-')) return recordAction(this.workoutOwner(),id,{kind:'routine',data:{expectedRevision,exercises:exercises as WorkoutExerciseSnapshot[],routineName}}); return this.request<WorkoutSessionRecord>(`/workouts/${encodeURIComponent(id)}/routine`, { method: 'PATCH', body: JSON.stringify({ expectedRevision, exercises, routineName }) }); }
  async cancelWorkout(id: string, expectedRevision: number) { if (id.startsWith('local-')) {
    await changeJournal(this.workoutOwner(),id,row => {
      if (!row || row.workout.status !== 'active' || row.workout.revision !== expectedRevision) throw new Error('Workout changed.');
      return null;
    }); return {cancelled:true};
  } return this.request<{ cancelled: boolean }>(`/workouts/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ expectedRevision }) }); }
  async createWorkout(data: any) { return this.request<any>('/workouts', { method: 'POST', body: JSON.stringify(data) }); }
  async getAdminExercises() { return this.request<any[]>('/admin/exercises'); }
  async createAdminExercise(data: any) { return this.request<any>('/admin/exercises', { method: 'POST', body: JSON.stringify(data) }); }
  async updateAdminExercise(id: string, data: Record<string, unknown>) { return this.request<any>(`/admin/exercises/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteAdminExercise(id: string) { return this.request<any>(`/admin/exercises/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async getAdminUsers(search = '', page = 1) { return this.request<{ items: { _id: string; name: string; email: string; isActive: boolean; createdAt?: string; lastSignIn?: string | null }[]; total: number; page: number; pageSize: number }>(`/admin/dashboard/users?${new URLSearchParams({search, page: String(page)})}`); }
  async getAdminUser(id: string) { return this.request<{user: {name: string; email: string}; profile: {name?: string; age?: string; height?: string; heightInches?: string; heightUnit?: string; weight?: string; weightUnit?: string; goal?: string} | null; split: {label: string; isWorkoutDay: boolean; exercises: string[]}[] | null; badges: {id: string; title: string}[] | null; badgeCoverageIncomplete: boolean} | null>(`/admin/dashboard/users/${encodeURIComponent(id)}`); }
  async getAdminFeedback(page = 1, filters: {status?: string; category?: string; platform?: string; search?: string; rating?: string; version?: string; from?: string; to?: string} = {}) { return this.request<{items: { _id: string; rating: number; category: string; message: string; platform?: string; appVersion?: string; createdAt?: string; adminStatus?: 'new'|'in_progress'|'resolved'; adminNote?: string }[]; total: number; page: number; pageSize: number}>(`/admin/dashboard/feedback?${new URLSearchParams({page: String(page), ...filters})}`); }
  async updateAdminFeedback(id: string, status: string, note: string) { return this.request<{saved: boolean}>(`/admin/dashboard/feedback/${encodeURIComponent(id)}`, {method:'PATCH', body:JSON.stringify({status,note})}); }
  async getAdminExerciseFeedback(filters: {source?:string;search?:string;days?:string} = {}) { return this.request<{ _id: {exercise: string; source: string}; responses: number; averageRpe: number; averageEnjoyment: number | null; tooEasy: number; justRight: number; tooHard: number }[]>(`/admin/dashboard/exercise-feedback?${new URLSearchParams(filters)}`); }
  async getAdminPoseEvidence() { return this.request<{exercise: string; sets: number; verified: number; agreement: number | null; zeroRepSets: number; zeroRepFalsePositives: number; lastReviewed: string}[]>('/admin/dashboard/pose-evidence'); }
  async addAdminPoseEvidence(input: {exercise: string; verified: number; predicted: number; conditions: string}) { return this.request<{saved: boolean}>('/admin/dashboard/pose-evidence', {method: 'POST', body: JSON.stringify(input)}); }
  async getAdminFoods() { return this.request<{top: {_id: string; count: number}[]; meals: number; savedScanEntries: number; scans: {status: string; count: number}[]}>('/admin/dashboard/foods'); }
  async getAdminAudit() { return this.request<{items: {_id: string; action: string; actorId?: string; targetId?: string; status?: number; occurredAt: string}[]}>('/admin/dashboard/audit'); }
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

  async getExercises(query?: ExerciseDiscoveryQuery) {
    const qs = new URLSearchParams();
    if (query?.search) qs.set('search', query.search);
    if (query?.muscle) qs.set('muscle', query.muscle);
    if (query?.equipment) qs.set('equipment', query.equipment);
    if (query?.bodyPart) qs.set('bodyPart', query.bodyPart);
    if (query?.target) qs.set('target', query.target);
    if (query?.secondary) qs.set('secondary', query.secondary);
    if (query?.sort) qs.set('sort', query.sort);
    if (query?.page) qs.set('page', String(query.page));
    qs.set('limit', String(query?.limit ?? 12));
    return this.request<ExerciseCatalog>(`/exercises?${qs.toString()}`, { timeoutMs: 60_000 }, getCoachApiBaseUrl());
  }
  async getExerciseFilters() { return this.request<ExerciseFilters>('/exercises/filters', { timeoutMs: 30_000 }, getCoachApiBaseUrl()); }
  async getExercise(slug: string) { return this.request<ExerciseRecord>(`/exercises/${encodeURIComponent(slug)}`, { timeoutMs: 30_000 }, getCoachApiBaseUrl()); }
  async getIndependentCoachPlan(profile: Record<string, unknown>) {
    const { goal, days, duration, equipment, conditions, createdAt } = profile;
    // The standalone coach validates strictly: an empty or numeric age, a
    // non-ISO consent date or non-string list entries would reject the whole
    // plan request, so only send optional fields in the exact accepted shape.
    const age = String(profile.age ?? '').trim();
    const consent = typeof profile.healthConsentAt === 'string' && !Number.isNaN(Date.parse(profile.healthConsentAt)) ? new Date(profile.healthConsentAt).toISOString() : null;
    const list = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(item => item && item.length <= 80))].slice(0, 10) : [];
    const health = consent ? { healthConsentAt: consent, injuries: list(profile.injuries), healthRisks: list(profile.healthRisks) } : {};
    return this.request<CoachPlanRecord>('/coach/plan', { method: 'POST', timeoutMs: 60_000, body: JSON.stringify({ profile: { goal, days, duration, equipment, conditions, createdAt, ...(/^\d{1,3}$/.test(age) && { age }), ...health } }) }, getCoachApiBaseUrl());
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
    timeoutMs: number = SCAN_TIMEOUT_MS,
    description?: string,
    signal?: AbortSignal
  ) {
    return this.request<ScanAnalysis>('/nutrition/scan', {
      method: 'POST',
      timeoutMs,
      signal,
      body: JSON.stringify({ image: image.base64, mimeType: image.mimeType, ...(description?.trim() ? { description: description.trim() } : {}) }),
    });
  }

  async searchFoods(query: string) {
    return this.request<{ request_id: string; candidates: FoodCandidate[] }>(`/nutrition/foods/search?q=${encodeURIComponent(query)}`);
  }


  async getFoodDetail(fdcId: number) {
    return this.request<FoodDetail>(`/nutrition/foods/${encodeURIComponent(fdcId)}`);
  }

  async getPoseStatus() { return this.request<{ available: boolean; reason?: string }>('/pose/status', { timeoutMs: 150_000 }); }
  async getPoseTrackerConfig(id: string) { return this.request<import('../../backend/src/pose-tracker/exercise-registry').TrackingConfig>(`/pose-tracker/exercises/${encodeURIComponent(id)}`, { timeoutMs: 15000 }); }
  async getPoseTrackerConfigs(ids: string[]) { return this.request<import('../../backend/src/pose-tracker/exercise-registry').TrackingConfig[]>('/pose-tracker/configurations', { method: 'POST', body: JSON.stringify({ids}), timeoutMs: 15000 }); }
  async launchPoseTracker(id: string, adminTest = false, native = false) { return this.request<{ config: import('../../backend/src/pose-tracker/exercise-registry').TrackingConfig; token: string | null; developerOutputs: boolean }>(adminTest ? `/admin/pose-tracker/exercises/${encodeURIComponent(id)}/test` : `/pose-tracker/exercises/${encodeURIComponent(id)}/launch`, { method: 'POST', ...(adminTest ? {} : { body: JSON.stringify({ native }) }), timeoutMs: 15000 }); }
  async getPoseTrackerCoverage() { return this.request<ReturnType<typeof import('../../backend/src/pose-tracker/exercise-registry').auditCoverage>>('/admin/pose-tracker/coverage'); }
  async savePoseTrackerConfig(id: string, config: import('../../backend/src/pose-tracker/exercise-registry').ConfigOverride) { return this.request<import('../../backend/src/pose-tracker/exercise-registry').TrackingConfig>(`/admin/pose-tracker/exercises/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(config) }); }
  async analyzePose(data: PoseAnalysisInput) { return this.request<unknown>('/pose/analyze', { method: 'POST', body: JSON.stringify(data), timeoutMs: 180_000 }); }
  async pauseWorkout(id: string, data: any) { if (id.startsWith('local-')) return recordAction(this.workoutOwner(),id,{kind:'pause',data:data}); return this.request<any>(`/workouts/${encodeURIComponent(id)}/pause`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async completeWorkout(id: string, data: any) { if (id.startsWith('local-')) {
    const owner = this.workoutOwner();
    const saved = await recordAction(owner,id,{kind:'complete',data});
    if (owner === this.workoutOwner()) {
      const previous = deviceCache.get<WorkoutSessionRecord[]>('workouts').data ?? await workoutHistorySnapshot(owner);
      if (owner === this.workoutOwner()) {
        deviceCache.publish('workouts',[saved,...previous.filter(row => row._id !== id)]);
        const summary = deviceCache.get<WorkoutSummary>('workout-summary').data;
        if (summary && saved.endedAt && (!saved.sets?.length || saved.sets.some(set => set.status === 'completed'))) {
          const date = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(saved.endedAt));
          deviceCache.publish('workout-summary',{...summary,trainingDates:[...new Set([...summary.trainingDates,date])].sort()});
        }
      }
      void this.syncManualWorkouts().catch(() => {});
    }
    return saved;
  } return this.request<any>(`/workouts/${encodeURIComponent(id)}/complete`, { method: 'POST', body: JSON.stringify(data) }); }

  /** Writes one meal row per selected item; unmatched nutrition stays unavailable. */
  async addMealsFromScan(data: { items: ScannedItem[]; meal: string; date?: string; time?: string; idempotency_key?: string }) {
    return this.request<any>('/nutrition/meals/from-scan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async getScanSaveReceipt(key: string) {
    return this.request<{ status: 'confirmed' | 'unknown'; save_id?: string; meal_ids?: string[] }>(`/nutrition/meals/from-scan/receipts/${encodeURIComponent(key)}`);
  }
}

export const api = new ApiClient();
