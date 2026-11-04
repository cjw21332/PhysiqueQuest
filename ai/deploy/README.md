# Production deployment

This package runs the web frontend, authenticated API, Coach catalogue service and a private Ollama runtime behind one HTTPS gateway. It uses the same application code as local development. No AI-provider key is required for Phiq. Database, storage and mail credentials remain ordinary application infrastructure secrets.

## Host and configuration

Use a Linux Docker host with sufficient RAM/disk and, for responsive model answers, a supported NVIDIA GPU with the NVIDIA Container Toolkit. The tested development GPU has 6 GB VRAM. Measure load on the intended host before sizing replicas; CPU fallback does not meet the same latency expectations. Public model files require about 4 GB plus image/cache space. The persistent model volume avoids downloading weights on every container restart.

Point a real DNS hostname at the host and permit inbound TCP 80/443. Only the gateway publishes ports. Backend, Coach, frontend and inference ports are private Docker-network endpoints. Keep host administrator access restricted.

Copy `.env.example` in this folder to `.env`, which Git ignores. Set the final hostname, TLS contact email, production MongoDB URI, strong JWT secret, **the existing health-encryption key for existing records**, object storage and a real mail provider. Do not copy development secrets or generate a replacement encryption key for already encrypted data. Back up the database, review and apply the existing backend index migrations with the intended database identity before release. See `backend/OPERATIONS.md`. The shared chat quota counters use the existing `auth_rate_limits` collection and TTL index.

## Validate and launch

Run from the repository root; Docker Compose paths are relative to the Compose file:

```powershell
rtk proxy docker compose --env-file ai/deploy/.env -f ai/deploy/compose.yaml -f ai/deploy/compose.gpu.yaml config --quiet
rtk proxy docker compose --env-file ai/deploy/.env -f ai/deploy/compose.yaml -f ai/deploy/compose.gpu.yaml up -d --build
rtk proxy docker compose --env-file ai/deploy/.env -f ai/deploy/compose.yaml -f ai/deploy/compose.gpu.yaml ps
```

Use the base file alone for CPU-only testing. The first inference startup downloads public weights, builds the Phiq alias and prewarms it before the backend dependency is considered healthy. This can take several minutes. Model files persist in `phiq-models`. Do not use `down --volumes` during routine updates.

Caddy obtains/renews the TLS certificate. `/api/*`, `/health` and `/ready` reach the backend, `/coach-api/api/*` reaches the independent Coach service, and other pages reach the frontend. Coach URL is built into the frontend; changing APP_DOMAIN requires rebuilding the frontend. The backend and Coach trust exactly the one gateway proxy. No request-body logging is enabled in the gateway.

Verify the actual deployment:

1. Open the HTTPS hostname and sign in with a synthetic account.
2. Confirm `/health` and `/ready` return healthy responses.
3. With that account's bearer authentication, check `GET /api/chat/status` returns `{"ready":true}`. It reveals no host/model details and requires authentication; do not paste tokens into shared logs or URLs.
4. Ask a page-help question, a saved-record question with consent off, then a saved-record question with consent on.
5. Confirm no Sources footer appears, logout/account replacement clears the conversation, and another synthetic account gets only its own records.
6. Verify Coach browsing through `/coach-api/api/coach/status`, storage uploads and real mail delivery separately.
7. Rebuild a native/mobile release with `EXPO_PUBLIC_WEB_APP_URL=https://YOUR_HOST` and `EXPO_PUBLIC_API_URL=https://YOUR_HOST/api`. Test actual-device cookies and permissions; Expo's local development server is not the production app distribution.

## Existing platform deployments

The backend can also run independently on a supported platform, with inference on that platform's private network or a privately routed GPU host. Set:

```dotenv
CHAT_OLLAMA_URL=http://phiq-inference.internal:11434
CHAT_OLLAMA_ALLOWED_HOSTS=phiq-inference.internal
CHAT_OLLAMA_MODEL=physiquequest-phiq
CHAT_WARMUP_ENABLED=true
CHAT_KEEP_ALIVE=30m
```

Every DNS answer must be loopback/private IPv4 or private IPv6 and is pinned to the connection. Public, link-local/metadata addresses, redirects and cloud-backed model aliases are rejected. Use TLS or an encrypted private tunnel when crossing an untrusted network. No frontend/mobile client may connect directly to inference. Render private services are an option only when the selected service/compute supports the model workload; this change does not create paid resources or assume GPU availability. A remote backend's localhost is never your development PC.

## Operations and limits

The backend prewarms production inference in the background and renews warm residency before idle eviction. `CHAT_MAX_OUTPUT_TOKENS` defaults to 384, `CHAT_CONTEXT_TOKENS` to 8192, `CHAT_MAX_CONCURRENCY` to 2 per API process, and metadata checks cache for 30 seconds. The Compose example uses one concurrent inference request for a small GPU; Ollama's own queue is bounded. Shared MongoDB account/IP quotas apply across API replicas; aggregate model capacity remains a runtime/host scheduling concern.

Page help uses reviewed direct responses and exact scalar metrics use deterministic formatting, so they do not wait for model generation. Generated answers depend on hardware, prompt size and load. There is no guarantee of zero delay or perfect factual/scope accuracy. Source IDs remain internal validation metadata and are not shown as reply footers. Chat does not write conversation history or train on personal records.

Update model/runtime images only after rerunning `rtk npm run ai:evaluate`, tests and a staged GPU smoke test. Runtime image version0.40.11 is explicitly selectable through OLLAMA_IMAGE; pin an approved image digest for a release. Optional image/video analysis, food search, push and emergency delivery remain separate providers; the chatbot does not enable them automatically.

## Verification boundary

Both Compose configurations and the inference startup shell syntax were validated, the Ollama image tag was confirmed in its registry, and application production builds passed. The local Docker engine was unavailable, so image builds, Caddy certificate issuance, GPU-container startup and a live production deployment have **not** been executed here. Complete those staging checks before routing users to this deployment.

References: [Ollama Docker](https://docs.ollama.com/docker), [Docker GPU reservations](https://docs.docker.com/compose/how-tos/gpu-support/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Render private services](https://render.com/docs/private-services).
