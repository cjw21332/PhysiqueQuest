# Deployment guide

Food Scanner is an **internal-only microservice**. It has no browser-facing
surface, no CORS policy, and no user accounts. Exactly one client is expected:
your main backend.

## Contents

- [Request topology](#request-topology)
- [⚠️ Read this first: IP allowlists and Render](#%EF%B8%8F-read-this-first-ip-allowlists-and-render)
- [Environment variables](#environment-variables)
- [Deploying as a Render Web Service](#deploying-as-a-render-web-service)
- [Deploying on a single private VM](#deploying-on-a-single-private-vm)
- [Rotating the shared secret](#rotating-the-shared-secret)
- [Rotating the provider API keys](#rotating-the-provider-api-keys)
- [Observability](#observability)
- [Firewall rules](#firewall-rules)

---

## Request topology

```
main backend
     |
     |  HTTPS, header: X-Internal-Api-Key: <shared secret>
     v
┌──────────────────────────────┐
│ nginx  (only published port) │
│  • TLS termination           │   ← network-level control
│  • source IP allowlist       │     (docker/allowlist.conf)
│  • per-IP rate limit         │
└──────────────┬───────────────┘
               │  plain HTTP, private container network
               v
┌──────────────────────────────┐
│ scanner  (no published port) │   ← app-level control
│  • shared-secret check       │     (X-Internal-Api-Key)
│  • request validation        │
│  • timeouts + rate limit     │
└──────────────┬───────────────┘
               v
        Gemini (vision) + USDA FDC (nutrition)
```

Two independent controls, either of which alone blocks a caller that lacks the
other. The scanner container publishes no port, so it has no address on the host
or the internet.

---

## ⚠️ Read this first: IP allowlists and Render

You are deploying a **Render Web Service** because Private Services are not on
your plan. A Web Service gets a public `*.onrender.com` hostname, and this
creates a problem with the nginx allowlist that you need to decide about before
you deploy.

**The problem:** on a Web Service, every inbound connection — including your main
backend's — arrives from *Render's edge*, not from your main backend. So:

- `allow <main-backend-ip>; deny all;` will reject **everything**, including
  Render's own health checks. The service will fail its health check and be
  restarted in a loop.
- Allowing Render's ranges to fix that opens the service to the entire internet,
  because a Web Service is publicly addressable.

**The options, in order of preference:**

1. **Keep the allowlist file empty and rely on the shared secret.** This is the
   realistic default on a Web Service plan. The `X-Internal-Api-Key` check is
   cryptographically strong, applied in constant time, and rejects everything
   without a valid token. You still get: TLS, per-IP rate limiting at the edge,
   full request logging, and a service that publishes no port to the Node
   process's neighbours.

2. **Use Render's own IP allowlist feature** if it is available on your plan.
   That is the correct place for this control on Render, and it terminates before
   your container even starts.

3. **Move to a Private Service** when the plan allows. Then the allowlist in
   `docker/allowlist.conf` works exactly as written, because the main backend
   connects to a private address.

4. **Terminate TLS at the main backend** and have it call Render over a private
   interconnect, if you have one.

`docker/allowlist.conf` ships with the rules commented out so the stack starts
cleanly. Fill it in only once you have confirmed the source IPs will actually be
the ones that arrive — see the TODO in that file.

---

## Environment variables

Required. **The service refuses to start if `SERVICE_TOKEN` is missing, shorter
than 32 characters, or a known placeholder** — it exits with code 78 rather than
serving traffic unauthenticated.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SERVICE_TOKEN` | **yes** | — | Shared secret for `X-Internal-Api-Key`. Min 32 chars. |
| `GEMINI_API_KEY` | **yes** | — | Google Gemini API key. |
| `USDA_API_KEY` | **yes** | — | USDA FoodData Central key. |
| `SERVICE_ID` | no | `unknown-backend` | Caller identity recorded in audit logs. |
| `GEMINI_MODEL` | no | `gemini-3.5-flash` | Vision model. Do not use the 2.5 generation (retired 2026-10-16). |
| `PORT` | no | `3001` | Inject by Render; do not set manually there. |
| `HOST` | no | `0.0.0.0` | Must stay `0.0.0.0` on Render. |
| `LOG_LEVEL` | no | `info` | `fatal`…`trace`, or `silent`. |
| `TRUST_PROXY_HOPS` | no | `0` | Set to `1` behind nginx or Render. Never higher than the real proxy count. |
| `REQUEST_TIMEOUT_MS` | no | `20000` | Total per-request budget. |
| `UPSTREAM_TIMEOUT_MS` | no | `10000` | Per Gemini/USDA call. |
| `MAX_IMAGE_BYTES` | no | `4194304` | Max decoded image size. |
| `MAX_BODY_BYTES` | no | `MAX_IMAGE_BYTES * 4/3 + 65536` | Hard JSON body cap. Usually left unset. |
| `MAX_SEARCH_QUERY_LENGTH` | no | `120` | Max `?q=` length. |
| `MAX_DETECTED_ITEMS` | no | `12` | Caps USDA fan-out per image. |
| `RATE_LIMIT_ENABLED` | no | `true` | Per-caller limiter. |
| `RATE_LIMIT_MAX` | no | `60` | Requests per window, per caller. |
| `RATE_LIMIT_WINDOW_MS` | no | `60000` | Window length. |
| `USDA_BASE` | no | `https://api.nal.usda.gov/fdc/v1` | Nutrition API base URL. |
| `SERVICE_TOKENS_PREVIOUS` | no | — | Retired tokens still accepted during rotation. Clear after migration. |

---

## Deploying as a Render Web Service

1. **Rotate both provider keys first.** See
   [Rotating the provider API keys](#rotating-the-provider-api-keys).

2. **Generate a shared secret** and store it in Render's environment, not in the
   repository:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Create the service** from this repository:
   - Root directory: repository root
   - Build command: `npm ci && npm --workspace server run build`
   - Start command: `node server/dist/index.js`
   - Health check path: `/livez`

   Using the start command directly rather than Docker means Render injects
   `PORT` and `HOST` itself, which the app reads.

4. **Set every environment variable** from the table above in Render's dashboard.
   Mark the secrets as *Secret* rather than plain text.

5. **Set `TRUST_PROXY_HOPS=1`.** Without it, every request appears to come from
   Render's internal address, which breaks per-caller rate limiting and makes
   audit logs useless for attribution.

6. **Do not set `PORT`.** Render assigns it.

7. **Confirm the app is not serving the browser app any more.** The SPA and the
   SQLite log endpoints were removed; see the README.

8. **Verify:**

   ```bash
   # Should succeed: unauthenticated probe, reveals nothing
   curl -sS https://<your-service>.onrender.com/livez

   # Should return 401 with a structured error
   curl -sS -i https://<your-service>.onrender.com/v1/analyze

   # Should return 200/503 with details
   curl -sS -H "X-Internal-Api-Key: $SERVICE_TOKEN" \
        https://<your-service>.onrender.com/v1/health
   ```

   If step two returns 200 instead of 401, stop and investigate: it means the
   token gate is not in front of the route.

### Using the Dockerfile on Render instead

Set the build to use the `Dockerfile`. It is multi-stage, runs as a non-root
user, and its `HEALTHCHECK` targets `/livez`. The `docker-compose.yml` file is
for the single-VM path below, not for Render.

---

## Deploying on a single private VM

1. `cp .env.example .env` and fill it in.
2. Populate `docker/allowlist.conf` with the main backend's outbound IPs. This
   works on a VM because the main backend connects directly.
3. `docker compose up -d --build`
4. Open the published port only to the main backend:

   ```bash
   # Allow the main backend, drop everything else
   sudo ufw allow from <MAIN_BACKEND_IP> to any port 8080 proto tcp
   sudo ufw deny 8080/tcp
   sudo ufw reload
   ```

5. If the main backend is on another host, change the `ports` mapping in
   `docker-compose.yml` from `127.0.0.1:8080:8080` to `8443:8080`, then rely on
   the allowlist plus the firewall above as the two network-level controls.

---

## Rotating the shared secret

Zero downtime, using the two-variable window:

1. Set `SERVICE_TOKENS_PREVIOUS` to the **current** `SERVICE_TOKEN` and set
   `SERVICE_TOKEN` to the **new** value, in the same deploy.
2. Roll the main backend so it sends the new token.
3. Confirm requests are succeeding with the new token.
4. Clear `SERVICE_TOKENS_PREVIOUS`.

Setting `SERVICE_TOKENS_PREVIOUS` to the same value as `SERVICE_TOKEN` is
rejected at boot, so a forgotten cleanup fails loudly rather than silently
keeping a compromised token alive.

---

## Rotating the provider API keys

The service holds no provider credentials of its own. To rotate:

1. Issue a new key in the Google AI Studio and USDA consoles.
2. Set the new values in the platform's environment and deploy.
3. Confirm `/v1/health` reports both upstreams as configured, then send a
   `POST /v1/analyze` and check it succeeds.
4. Revoke the old keys at the provider.

---

## Observability

Every request produces one JSON line on stdout, including rejected ones:

```json
{"level":"info","time":"...","service":"food-scanner","event":"http_request",
 "request_id":"…","service_id":"main-backend","method":"POST","path":"/v1/analyze",
 "status":200,"duration_ms":1840,"content_length":284103}
```

Plus, for analysis specifically, a `analysis_completed` line with
`image_bytes`, `detected_items`, `matched_items` and `unmatched_items` — enough
to attribute provider spend to a caller without logging the image itself.

**What is never logged:** the `X-Internal-Api-Key` value, the image payload, any
provider API key, or query strings. The USDA key is passed as a URL query
parameter because the USDA API requires it, so `safeUrl()` strips the query
string from every logged URL; this is the one place a secret is unavoidably in
transit, and it is the provider's requirement, not a choice made here.

Correlate across services with `X-Request-Id`: the scanner honours an inbound
value when it matches `[A-Za-z0-9._:-]{1,128}`, echoes it back, and stamps it on
every log line. A value containing spaces or control characters is discarded and
replaced with a fresh UUID, so a caller cannot forge log entries.

---

## Firewall rules

The service is not hardened by its own firewall; the layers in front of it are:

| Layer | Where | What it blocks |
| --- | --- | --- |
| Render IP allowlist / host firewall | Platform | Any source not permitted |
| `docker/allowlist.conf` | nginx | Any source not on the list, before Node sees it |
| Per-IP rate limit | nginx | Floods and bursts |
| `X-Internal-Api-Key` | app | Any caller without the shared secret |
| `RATE_LIMIT_*` | app | One misbehaving caller draining shared quota |
| Timeouts | app | Any single request holding resources |

Do not treat the application-level token as the only control: it is the second
line, not the first.
