import type {
  AnalyzeResponse,
  ApiErrorBody,
  FoodCandidate,
  FoodDetail,
  LogPayload,
  StoredLog,
} from "./types";

/**
 * The browser talks to the main backend, never to Food Scanner directly.
 * Food Scanner is an internal-only service behind a shared-secret header, so
 * the browser has no way to reach it and must not hold that secret.
 *
 * Point the app at the main backend with VITE_MAIN_BACKEND_URL. When it is
 * unset the app falls back to same-origin "/api", which is what the main
 * backend should serve in production.
 */
const BASE = import.meta.env.VITE_MAIN_BACKEND_URL ?? "/api";

/** Unwraps the structured error envelope, falling back to a generic message. */
async function toError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  if (body?.error?.message) {
    const err = new Error(body.error.message);
    // Correlation id for reporting a failure against server logs.
    (err as Error & { requestId?: string }).requestId = body.error.request_id;
    return err;
  }
  return new Error(`${fallback} (HTTP ${res.status})`);
}

export async function analyze(image: string, mimeType: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, mimeType }),
  });
  if (!res.ok) throw await toError(res, "Analysis failed");
  return res.json();
}

export async function searchFoods(q: string): Promise<FoodCandidate[]> {
  const res = await fetch(`${BASE}/foods/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw await toError(res, "Food search failed");
  const data = await res.json();
  return data.candidates || [];
}

export async function getFood(fdcId: number): Promise<FoodDetail> {
  const res = await fetch(`${BASE}/foods/${fdcId}`);
  if (!res.ok) throw await toError(res, "Food lookup failed");
  return res.json();
}

export async function saveLog(payload: LogPayload): Promise<{ id: number }> {
  const res = await fetch(`${BASE}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await toError(res, "Save failed");
  return res.json();
}

export async function getLogs(): Promise<StoredLog[]> {
  const res = await fetch(`${BASE}/log`);
  if (!res.ok) throw await toError(res, "Load failed");
  return res.json();
}
