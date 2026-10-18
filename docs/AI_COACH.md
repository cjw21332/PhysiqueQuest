# AI Coach and exercise library on the shared API

The main NestJS backend serves ExerciseDB V1 browsing, PhysiqueQuest manual guides, stateless Coach previews and authenticated saved programs on port 4000. RepDB guides are a lazy-loaded frontend source. Provider credentials remain server-side.

## Run the backend

From the repository root:

```powershell
npm --prefix backend run start:dev
```

For a production process:

```powershell
npm --prefix backend run build
npm --prefix backend run start:prod
```

Start the frontend and Expo separately as described in [RUNNING.md](../RUNNING.md). The separate Coach/library listener and its startup scripts have been removed. Both library and account requests use `NEXT_PUBLIC_API_URL` or the API address injected by the Expo WebView; development defaults to the page hostname on port 4000. Old `NEXT_PUBLIC_COACH_API_URL` and `physiquequest-runtime-coach-url` settings are ignored.

`/exercises` remains a frontend library route with bottom navigation. The main API's catalog routes are public, so an unavailable account/profile does not require a login to browse. They still depend on the main backend being online; the shared backend connects to MongoDB at startup. Saved programs and admin records remain authenticated. See [architecture and migration details](COMBINED_API.md).

## Saved user programs

The Coach screen requests authenticated `GET /api/coach/plan` from the account API. On the first request for a user's training preferences, the Coach module generates an ExerciseDB program and saves its weekly schedule, daily exercise IDs, order, prescriptions and cues in MongoDB's `coach_programs` collection. Later visits, refreshes and backend restarts reuse that snapshot without exercise-provider requests. Reading a program still makes a small request to the application's own API.

Programs are keyed by authenticated user ID and a hash of goal, canonical training weekdays, equipment, duration, health conditions and planner version. Changed program preferences generate another saved version; display-name/contact changes do not. Equivalent legacy and full weekday names reuse the same version. A unique compound index prevents duplicate records. Concurrent loads within one server share generation. Saved versions do not expire daily: daily sessions repeat until preferences change. Week labels update locally without regenerating exercises.

The server reads profile/settings directly; clients cannot choose another user's saved program. Failed or empty generations are not saved. A provider outage does not affect an existing matching version; new preferences still require a successful provider response. GIF URLs/media are not stored with the program and are refreshed through the detail endpoint. The shared API also retains public `POST /api/coach/plan` as a stateless preview endpoint; the Coach screen uses the authenticated saved endpoint.

## API contract

- `GET /api/exercises?muscle=Chest&equipment=Dumbbells&page=1&limit=12`: common exercise selection, provider IDs, GIF URL, instructions and metadata. UI categories map to provider body-part/equipment names. Results and pagination describe the bounded returned selection, not all 1,500 records.
- `GET /api/exercises?search=barbell%20bench%20press`: name-specific search across the provider. Exact/all-word matches rank first; narrowly matched typo suggestions are used only when precise matches are absent. Unrelated fuzzy suggestions are excluded.
- `GET /api/exercises/:exerciseId`: current provider details and GIF URL. Opening or retrying a detail sheet refreshes this data.
- `POST /api/coach/plan`: validated `{ "profile": { "goal": "Build muscle", "days": ["Monday", "Wednesday", "Friday"], "duration": "45 min", "equipment": ["Dumbbells"], "conditions": [] } }` context. Suggestions, prescriptions and cues come from the shared planner and live ExerciseDB candidates. This preview writes no profile or program records.

List and detail data are normalized at the server. V1 does not supply difficulty levels, personalized loads, AI form scores, or a video duration; the UI does not invent them. Recommendations are general program prescriptions. Form cues are drawn from actual provider instructions and do not imply live AI form assessment. The GIF controls display the real animation and freeze its current frame when paused; they are not MP4 playback controls.

## Availability and attribution

The free provider applies strict rate limits. Requests are bounded, paced and deduplicated while in flight; upstream failures and rate limits remain visible with retry. User program snapshots are persisted; no full provider catalog or media is downloaded/stored, and the old local exercise catalog is never an error fallback. Categories with inadequate provider coverage must show the available results rather than invent ten exercises. The initial selection favors common names; it does not claim measured popularity statistics.

Exercise data is provided by [AscendAPI](https://ascendapi.com), using the [ExerciseDB free V1 API](https://oss.exercisedb.dev/docs). Its documented free-use restriction is non-commercial/personal/educational use with attribution. Commercial use requires appropriate provider access.

Camera rep counting beta entries and automatic tracking deep links are hidden in the frontend. Existing rep-counter, worker/native bridge and backend workout-completion capability remain in the codebase for later reactivation.
