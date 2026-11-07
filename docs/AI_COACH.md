# Independent AI Coach and ExerciseDB V1

## Persistent catalog

The Coach service uses `MONGODB_URI` by default and stores ExerciseDB records in separate `exercisedb_catalog` and `exercisedb_sync` collections. Set `EXERCISE_CATALOG_MONGODB_URI` to isolate those collections in another database, or set `EXERCISE_CATALOG_ENABLED=false` to use the live-provider fallback. The worker retrieves one cursor page at a time, checkpoints progress, applies exponential retry delays, and starts another full pass after 24 hours. Existing records are retained when a request fails. Only enable use within the provider's permitted terms below.

`GET /api/exercises/sync-status` reports the provider total, local record count, status, consecutive failures, and last successful pass. While a pass is incomplete, search results cover only the records already saved and indicate partial coverage. The browser stores metadata in IndexedDB and installs a public offline library shell; account data and authenticated API responses are not stored in Cache Storage. The shell supports cached exercise details but does not guarantee offline GIF playback. Browser storage may be evicted or unavailable. No GIF collection is downloaded by the catalog worker.

After a provider GIF actually loads in the detail sheet, the service worker can retain that viewed response locally. It keeps at most six demonstrations, evicts the least recently viewed entry, and skips new entries when reported origin storage is at least 80% full. Cache failures do not block exercise details. Cross-origin media responses may be opaque, so the worker only retains a response after the browser reports a successful image load. A label indicates whether the demonstration is stored; an unviewed or evicted GIF still needs connectivity. Browser storage limits and eviction remain outside the application's control.

The offline shell is installed after an online visit in a secure context (HTTPS or localhost). A fully offline navigation opens this public shell; workouts and account features still require a connection. Once connectivity returns, the shell returns to the online exercise route, where device synchronization can resume. The browser commits catalog version metadata only after it receives the expected number of distinct records.

For a resumable, metadata-only media audit, set `EXERCISE_AUDIT_MONGODB_URI` and `EXERCISE_AUDIT_OUTPUT`, then run `node scripts/audit-exercisedb-media.mjs` from `backend`. The audit uses a single request at a time, a minimum 1.2-second delay, HEAD requests, and pauses on rate limits or access denial. Results are JSON Lines and do not contain GIF bodies. A successful HEAD response does not replace representative browser-rendering checks. `scripts/verify-exercisedb-recovery.mjs` exercises checkpoint recovery in a separate local verification database with synthetic fixtures.

AI Coach's library and exercise suggestions use the **free ExerciseDB V1 API**, not the old seeded MongoDB catalog. V1 currently exposes about 1,500 exercises with 180p animated GIFs and step-by-step instructions. It requires no API key. This is a different dataset from the subscription V2 catalog of 11,000+ exercises.

## Run the service

From the repository root:

```powershell
npm --prefix backend run build
npm run coach
```

For automatic rebuilding during development:

```powershell
npm run coach:dev
```

The standalone service listens on `http://localhost:4050/api`. It imports Coach planning and the ExerciseDB provider, and uses the configured catalog database; it does not boot authentication, nutrition, notifications, safety or other feature modules. `GET /api/coach/status` reports the local service/source; it is not a guarantee that the external provider is reachable.

The frontend uses the same-origin `/api/coach-service` proxy by default; `COACH_BACKEND_URL` points the Next server to the Coach service (default `http://127.0.0.1:4050`). For separate hosting, set `NEXT_PUBLIC_COACH_API_URL` to the public Coach API URL before building the frontend. Runtime overrides use the `physiquequest-runtime-coach-url` browser setting. Configure `COACH_PORT` and comma-separated `COACH_FRONTEND_URL` in `backend/.env` for direct service deployment.

`/exercises` is a standalone frontend library route with bottom navigation. Coach also offers Browse exercise library if the account/profile service cannot load. Saved personalized programs and workout persistence use the authenticated account API on port 4000; catalog browsing remains independent on port 4050.

## Saved user programs

The Coach screen requests authenticated `GET /api/coach/plan` from the account API. On the first request for a user's training preferences, the Coach module generates an ExerciseDB program and saves its weekly schedule, daily exercise IDs, order, prescriptions and cues in MongoDB's `coach_programs` collection. Later visits, refreshes and backend restarts reuse that snapshot without exercise-provider requests. Reading a program still makes a small request to the application's own API.

Programs are keyed by authenticated user ID and a hash of goal, canonical training weekdays, equipment, duration, health conditions and planner version. Changed program preferences generate another saved version; display-name/contact changes do not. Equivalent legacy and full weekday names reuse the same version. A unique compound index prevents duplicate records. Concurrent loads within one server share generation. Saved versions do not expire daily: daily sessions repeat until preferences change. Week labels update locally without regenerating exercises.

The server reads profile/settings directly; clients cannot choose another user's saved program. Failed or empty generations are not saved. A provider outage does not affect an existing matching version; new preferences still require a successful provider response. GIF URLs/media are not stored with the program and are refreshed through the detail endpoint. The standalone `POST /api/coach/plan` remains a stateless preview/generation endpoint; the Coach screen uses the saved endpoint instead.

## API contract

- `GET /api/exercises?muscle=Chest&equipment=Dumbbells&page=1&limit=12`: paginated catalog records with provider IDs, GIF URL, instructions and metadata. Filters and search operate on the synchronized catalog.
- `GET /api/exercises?search=barbell%20bench%20press`: searches synchronized names, muscles, equipment and instructions. Additional parameters `bodyPart`, `target`, `secondary`, and `sort` support combined discovery.
- `GET /api/exercises/:exerciseId`: synchronized exercise details and original GIF URL. The server falls back to the provider for an ID not yet present in its catalog.
- `POST /api/coach/plan`: validated `{ "profile": { "goal": "Build muscle", "days": ["Monday", "Wednesday", "Friday"], "duration": "45 min", "equipment": ["Dumbbells"], "conditions": [] } }` context. Suggestions, prescriptions and cues come from the shared planner and live ExerciseDB candidates. No profile records are written by this service.

List and detail data are normalized at the server. V1 does not supply difficulty levels, personalized loads, AI form scores, or a video duration; the UI does not invent them. Recommendations are general program prescriptions. Form cues are drawn from actual provider instructions and do not imply live AI form assessment. The GIF controls display the real animation and freeze its current frame when paused; they are not MP4 playback controls.

## Availability and attribution

The free provider applies strict rate limits. Requests are paced and deduplicated while in flight; failures are retried from the saved checkpoint. Metadata is persisted, but media is not mirrored. The old local exercise catalog is never an error fallback.

Exercise data is provided by [AscendAPI](https://ascendapi.com), using the [ExerciseDB free V1 API](https://oss.exercisedb.dev/docs). Its documented free-use restriction is non-commercial/personal/educational use with attribution. Commercial use requires appropriate provider access.

Camera rep counting beta entries and automatic tracking deep links are hidden in the frontend. Existing rep-counter, worker/native bridge and backend workout-completion capability remain in the codebase for later reactivation.
