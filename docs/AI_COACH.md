# Independent AI Coach and ExerciseDB V1

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

The standalone service listens on `http://localhost:4050/api`. It imports only Coach planning and the ExerciseDB provider: it does not connect to MongoDB or boot authentication, nutrition, notifications, safety or other feature modules. `GET /api/coach/status` reports the local service/source; it is not a guarantee that the external provider is reachable.

The frontend derives the Coach URL from the loaded page's hostname and port 4050, including LAN/Expo pages. For separate hosting, set `NEXT_PUBLIC_COACH_API_URL` to the public Coach API URL before building the frontend. Runtime overrides use the `physiquequest-runtime-coach-url` browser setting. Configure `COACH_PORT` and comma-separated `COACH_FRONTEND_URL` in `backend/.env` for service deployment. Development CORS also accepts private LAN frontend addresses on port 3000; production origins must be explicit.

`/exercises` is a standalone frontend library route with bottom navigation. Coach also offers Browse exercise library if the account/profile service cannot load. Saved personalized programs and workout persistence use the authenticated account API on port 4000; catalog browsing remains independent on port 4050.

## Saved user programs

The Coach screen requests authenticated `GET /api/coach/plan` from the account API. On the first request for a user's training preferences, the Coach module generates an ExerciseDB program and saves its weekly schedule, daily exercise IDs, order, prescriptions and cues in MongoDB's `coach_programs` collection. Later visits, refreshes and backend restarts reuse that snapshot without exercise-provider requests. Reading a program still makes a small request to the application's own API.

Programs are keyed by authenticated user ID and a hash of goal, canonical training weekdays, equipment, duration, health conditions and planner version. Changed program preferences generate another saved version; display-name/contact changes do not. Equivalent legacy and full weekday names reuse the same version. A unique compound index prevents duplicate records. Concurrent loads within one server share generation. Saved versions do not expire daily: daily sessions repeat until preferences change. Week labels update locally without regenerating exercises.

The server reads profile/settings directly; clients cannot choose another user's saved program. Failed or empty generations are not saved. A provider outage does not affect an existing matching version; new preferences still require a successful provider response. GIF URLs/media are not stored with the program and are refreshed through the detail endpoint. The standalone `POST /api/coach/plan` remains a stateless preview/generation endpoint; the Coach screen uses the saved endpoint instead.

## API contract

- `GET /api/exercises?muscle=Chest&equipment=Dumbbells&page=1&limit=12`: common exercise selection, provider IDs, GIF URL, instructions and metadata. UI categories map to provider body-part/equipment names. Results and pagination describe the bounded returned selection, not all 1,500 records.
- `GET /api/exercises?search=barbell%20bench%20press`: name-specific search across the provider. Exact/all-word matches rank first; narrowly matched typo suggestions are used only when precise matches are absent. Unrelated fuzzy suggestions are excluded.
- `GET /api/exercises/:exerciseId`: current provider details and GIF URL. Opening or retrying a detail sheet refreshes this data.
- `POST /api/coach/plan`: validated `{ "profile": { "goal": "Build muscle", "days": ["Monday", "Wednesday", "Friday"], "duration": "45 min", "equipment": ["Dumbbells"], "conditions": [] } }` context. Suggestions, prescriptions and cues come from the shared planner and live ExerciseDB candidates. No profile records are written by this service.

List and detail data are normalized at the server. V1 does not supply difficulty levels, personalized loads, AI form scores, or a video duration; the UI does not invent them. Recommendations are general program prescriptions. Form cues are drawn from actual provider instructions and do not imply live AI form assessment. The GIF controls display the real animation and freeze its current frame when paused; they are not MP4 playback controls.

## Availability and attribution

The free provider applies strict rate limits. Requests are bounded, paced and deduplicated while in flight; upstream failures and rate limits remain visible with retry. User program snapshots are persisted; no full provider catalog or media is downloaded/stored, and the old local exercise catalog is never an error fallback. Categories with inadequate provider coverage must show the available results rather than invent ten exercises. The initial selection favors common names; it does not claim measured popularity statistics.

Exercise data is provided by [AscendAPI](https://ascendapi.com), using the [ExerciseDB free V1 API](https://oss.exercisedb.dev/docs). Its documented free-use restriction is non-commercial/personal/educational use with attribution. Commercial use requires appropriate provider access.

Camera rep counting beta entries and automatic tracking deep links are hidden in the frontend. Existing rep-counter, worker/native bridge and backend workout-completion capability remain in the codebase for later reactivation.
