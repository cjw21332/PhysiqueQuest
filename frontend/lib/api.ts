// API client configuration
import { clearAuthSession } from './session';

export function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  // Expo Go loads this site from the computer's LAN address. In that context,
  // localhost would point back to the phone, so use the WebView's site host.
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000/api`;
  }

  return 'http://localhost:4000/api';
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

/** Per-100 g macros, as reported alongside a scanned item. Informational only. */
export interface ScannedMacros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
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

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${getApiBaseUrl()}${endpoint}`;

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
        if (response.status === 401) clearAuthSession();
        const raw = error.message;
        const message =
          (Array.isArray(raw) ? raw.join(', ') : raw?.trim()) ||
          `Request failed (${response.status})`;
        throw new ApiRequestError(message, response.status, error.code);
      }

      return await response.json();
    } catch (error) {
      // Only report a timeout when our own timer fired, so a genuine network
      // failure or a caller-driven abort is not mislabelled as a slow server.
      if (timedOut) throw new ApiTimeoutError(cap);
      if (error instanceof Error) {
        throw error;
      }
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

  async getProfile() {
    return this.request<any>('/profile', {
      method: 'GET',
    });
  }

  async updateProfile(data: unknown) {
    return this.request<any>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getNutrition() { return this.request<any>('/nutrition'); }
  async addMeal(data: unknown) { return this.request<any>('/nutrition/meals', { method: 'POST', body: JSON.stringify(data) }); }
  async updateMeal(id: string, data: unknown) { return this.request<any>(`/nutrition/meals/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteMeal(id: string) { return this.request<any>(`/nutrition/meals/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async setWater(data: { date: string; glasses: number }) { return this.request<any>('/nutrition/water', { method: 'PUT', body: JSON.stringify(data) }); }
  async getSettings() { return this.request<any>('/settings'); }
  async updateSettings(values: Record<string, unknown>) { return this.request<any>('/settings', { method: 'PUT', body: JSON.stringify({ values }) }); }
  async getActivity() { return this.request<any>('/activity/state'); }
  async updateActivity(state: Record<string, unknown>) { return this.request<any>('/activity/state', { method: 'PUT', body: JSON.stringify({ state }) }); }
  async getNotifications() { return this.request<any>('/notifications'); }
  async markNotification(id: string, unread: boolean) { return this.request<any>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: JSON.stringify({ unread }) }); }
  async markAllNotifications() { return this.request<any>('/notifications/read-all', { method: 'POST' }); }

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

  /** Writes one meal row per item that carries a USDA match. */
  async addMealsFromScan(data: { items: ScannedItem[]; meal: string; date?: string; time?: string }) {
    return this.request<any>('/nutrition/meals/from-scan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
