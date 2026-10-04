# Food Scanner

**Internal-only microservice.** Turns a food image into detected food items with
scaled macronutrient estimates. It is not a public API and has no browser-facing
surface: the only supported caller is the main backend, over a private network
path, presenting a shared secret on every request.

- **Vision**: Google Gemini (`@google/genai`) detects the foods in the image and
  estimates an edible weight for each.
- **Nutrition**: USDA FoodData Central supplies per-100g calories, protein,
  carbs and fat, scaled to the estimated weight and cached in-process.
- **Stateless**: meal persistence and user-facing history moved to the main
  backend. This service holds no user data and writes nothing to disk.

## Architecture

```
                    ┌─────────────────────────────┐
  browser ────────► │  main backend               │
  (untrusted)       │  owns auth, sessions, meals │
                    └──────────────┬──────────────┘
                                   │  X-Internal-Api-Key: <shared secret>
                                   ▼
                    ┌─────────────────────────────┐
                    │  food-scanner  (this repo)  │
                    │  Express · /v1 · stateless  │
                    └──────────────┬──────────────┘
                                   ▼
                    Gemini (vision)  +  USDA FDC (nutrition)
```

Two independent controls protect the service, either sufficient on its own:

| Control | Layer | Implementation |
| --- | --- | --- |
| Source IP allowlist | nginx | `docker/allowlist.conf` |
| TLS | nginx | `docker/tls.conf` |
| Shared secret | application | `X-Internal-Api-Key`, constant-time compare |
| Request validation | application | Zod schemas, `server/src/schemas.ts` |
| Timeouts and rate limits | application | `middleware/deadline.ts`, `middleware/rateLimit.ts` |

> **Before deploying on a Render Web Service, read
> [`docs/DEPLOY.md`](docs/DEPLOY.md#%EF%B8%8F-read-this-first-ip-allowlists-and-render).**
> A Web Service is publicly addressable and all traffic arrives from Render's
> edge, so an IP allowlist keyed on the main backend's addresses will reject
> Render's own health checks. The allowlist ships empty for that reason.

## API

Full contract: [`docs/openapi.yaml`](docs/openapi.yaml).

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/livez` | none | Liveness. Returns only `{"status":"ok"}`. |
| `GET` | `/readyz` | none | Readiness. Reports whether upstreams are configured. |
| `GET` | `/v1/health` | **token** | Operational detail, limits, uptime. |
| `POST` | `/v1/analyze` | **token** | Image → detected foods + nutrition. |
| `GET` | `/v1/foods/search?q=` | **token** | Search the nutrition database. |
| `GET` | `/v1/foods/{fdcId}` | **token** | Per-100g nutrition for one food. |

### Example

```bash
curl -sS -X POST https://food-scanner.internal/v1/analyze \
  -H "X-Internal-Api-Key: $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$(base64 -w0 meal.jpg)\",\"mimeType\":\"image/jpeg\"}"
```

```json
{
  "request_id": "3f1c9a2e-5b7d-4c8a-9e1f-2a6b3c4d5e6f",
  "model": "gemini-3.5-flash",
  "items": [
    {
      "food_name": "chicken breast",
      "est_weight_g": 150,
      "confidence": 0.92,
      "found": true,
      "fdc_id": 171477,
      "description": "Chicken breast, raw",
      "kcal": 180,
      "protein_g": 33.8,
      "carbs_g": 0,
      "fat_g": 3.9,
      "per_100g": { "kcal": 120, "protein_g": 22.5, "carbs_g": 0, "fat_g": 2.6 }
    }
  ],
  "unmatched": [],
  "totals": { "kcal": 180, "protein_g": 33.8, "carbs_g": 0, "fat_g": 3.9 },
  "degraded": false
}
```

### Errors

Every failure returns the same envelope. Branch on `code`, never on `message`.

```json
{
  "error": {
    "code": "UPSTREAM_TIMEOUT",
    "message": "vision model did not respond in time",
    "request_id": "3f1c9a2e-5b7d-4c8a-9e1f-2a6b3c4d5e6f",
    "details": { "upstream": "vision model" }
  }
}
```

| Code | Status | Meaning |
| --- | --- | --- |
| `INVALID_REQUEST` | 400 | Schema validation failed, or unparseable JSON |
| `UNAUTHENTICATED` | 401 | Missing or invalid `X-Internal-Api-Key` |
| `NOT_FOUND` | 404 | Unknown route or food identifier |
| `PAYLOAD_TOO_LARGE` | 413 | Body over `MAX_BODY_BYTES` |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Not JSON, or the bytes are not JPEG/PNG/WebP |
| `RATE_LIMITED` | 429 | Caller exceeded its budget; see `Retry-After` |
| `INTERNAL` | 500 | Unexpected failure; detail is in the logs |
| `SERVICE_UNAVAILABLE` | 503 | A provider credential is not configured |
| `UPSTREAM_UNAVAILABLE` | 502 | Provider returned an error |
| `UPSTREAM_TIMEOUT` / `TIMEOUT` | 504 | Provider or request exceeded its budget |

`request_id` is also returned in the `X-Request-Id` header. Supply your own to
correlate across services; values outside `[A-Za-z0-9._:-]{1,128}` are discarded
and replaced, so a caller cannot forge log entries.

### Notes for callers

- **`degraded: true` still returns 200.** Vision succeeded but a nutrition lookup
  failed; the item list is complete but some macros are zeroed. Surface it
  rather than discarding the result.
- **A food with no nutrition match is not an error.** It comes back
  `found: false` with its name in `unmatched`.
- **Image URLs are rejected by design.** A server-side fetch of a caller-supplied
  URL is an SSRF primitive against the internal network. Send base64.
- **The declared `mimeType` is advisory.** The service sniffs the actual bytes
  and rejects anything that is not JPEG, PNG or WebP.
- **Retrying is safe.** No partial state is written.

## Setup

```bash
npm install
cp .env.example .env      # then set SERVICE_TOKEN, GEMINI_API_KEY, USDA_API_KEY
npm run verify            # typecheck + tests + build
```

The service **refuses to start** if `SERVICE_TOKEN` is missing, shorter than 32
characters, or a known placeholder. It exits with code 78 rather than serving
traffic unauthenticated.

### Browser app

`client/` is a React app that now calls the **main backend**, not this service.
Point it with `VITE_MAIN_BACKEND_URL`; it falls back to same-origin `/api`. The
browser has no way to reach Food Scanner and must never hold the shared secret.

## Environment

Full table with defaults: [`docs/DEPLOY.md`](docs/DEPLOY.md#environment-variables).

| Var | Required | Default |
| --- | --- | --- |
| `SERVICE_TOKEN` | **yes** | — |
| `GEMINI_API_KEY` | **yes** | — |
| `USDA_API_KEY` | **yes** | — |
| `SERVICE_ID` | no | `unknown-backend` |
| `GEMINI_MODEL` | no | `gemini-3.5-flash` |
| `PORT` | no | `3001` |
| `HOST` | no | `0.0.0.0` |
| `LOG_LEVEL` | no | `info` |
| `TRUST_PROXY_HOPS` | no | `0` |
| `REQUEST_TIMEOUT_MS` | no | `20000` |
| `UPSTREAM_TIMEOUT_MS` | no | `10000` |
| `MAX_IMAGE_BYTES` | no | `4194304` |
| `MAX_BODY_BYTES` | no | `MAX_IMAGE_BYTES * 4/3 + 65536` |
| `MAX_SEARCH_QUERY_LENGTH` | no | `120` |
| `MAX_DETECTED_ITEMS` | no | `12` |
| `RATE_LIMIT_ENABLED` | no | `true` |
| `RATE_LIMIT_MAX` | no | `60` |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` |
| `USDA_BASE` | no | `https://api.nal.usda.gov/fdc/v1` |
| `SERVICE_TOKENS_PREVIOUS` | no | — |

Do not set `PORT` on Render; it is injected. `HOST` must stay `0.0.0.0` there,
because Render's router cannot reach a loopback-bound process.

Generate the shared secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Deployment

- **Render Web Service** — build `npm ci && npm --workspace server run build`,
  start `node server/dist/index.js`, health check `/livez`.
  See [`docs/DEPLOY.md`](docs/DEPLOY.md#deploying-as-a-render-web-service).
- **Single private VM** — `docker compose up -d --build`, then open the
  published port only to the main backend.
  See [`docs/DEPLOY.md`](docs/DEPLOY.md#deploying-on-a-single-private-vm).
- **Dockerfile** — multi-stage, non-root, read-only filesystem, health check.

The service container publishes no port; only nginx does.

## Observability

One JSON line per request on stdout, including rejected ones:

```json
{"level":"info","time":"2026-01-01T00:00:00.000Z","service":"food-scanner",
 "event":"http_request","request_id":"…","service_id":"main-backend",
 "method":"POST","path":"/v1/analyze","status":200,"duration_ms":1840}
```

Never logged: the shared secret, the image payload, provider API keys, or query
strings. `analysis_completed` lines carry item counts so provider spend can be
attributed to a caller without logging user images.

## Tests

```bash
npm test
```

106 tests covering the token gate (including constant-time comparison and
prefix-confusion cases), every documented status code, the error envelope,
redaction, boot-time config validation, and a contract test that validates the
OpenAPI examples against the runtime Zod schemas so the two cannot drift.

## What changed in 2.0

Security and contract work. Breaking:

- All routes moved to `/v1`; `/api/*` is gone.
- Every `/v1` route requires `X-Internal-Api-Key`.
- Response fields are snake_case: `fdcId` → `fdc_id`, `per100` → `per_100g`,
  `dataType` → `data_type`. `analyze` responses gained `request_id`, `unmatched`,
  `totals` and `degraded`.
- Errors use a structured `{ error: { code, message, request_id, details } }`
  envelope instead of `{ error: "string" }`.

Removed:

- Static SPA serving and permissive CORS. The service is no longer a website.
- The SQLite meal log and its endpoints; persistence belongs to the main
  backend. `data.sqlite` remains on disk, untouched, in case it is wanted back.
