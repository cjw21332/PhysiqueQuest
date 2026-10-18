# Shared backend API — October 18, 2026

Exercise browsing, Coach previews, saved programs, account features and workouts now run in one NestJS process. The main backend already registered the provider-backed library module; the frontend previously bypassed it and called a second listener. Browsing now uses the same API URL resolution as account/workout requests, including `NEXT_PUBLIC_API_URL` and the address injected by the Android WebView. The old `NEXT_PUBLIC_COACH_API_URL` and browser `physiquequest-runtime-coach-url` values are ignored.

## Routes and ownership

- Public `GET /api/exercises` and `GET /api/exercises/:id` return provider-backed ExerciseDB data or explicit PhysiqueQuest guides. They do not read private user/admin exercise records.
- Public `POST /api/coach/plan` retains the validated stateless preview contract and legacy weekday normalization inside `CoachPreviewModule`. It writes no profile/program records.
- Authenticated `GET /api/coach/plan` reads the authenticated user's saved program. Its existing ownership checks, persistence and versioning are unchanged.
- `/api/admin/exercises` continues to require authentication and an administrator role.
- RepDB guides still load as a separate lazy frontend source, with attribution. Pose processing remains local to the device.

`ExerciseDbModule` is imported by the library and Coach modules. Nest reuses its provider instance within the application. Concurrent matching provider reads can therefore share the existing in-flight request deduplication and pacing. This change adds no catalog sync, background job, polling, database collection or pose upload.

The second NestJS bootstrap, separate-service URL resolver and separate startup scripts were removed. Render now declares two services (web and API), instead of three. This removes one Node/Nest process and a separate service startup/deployment. Actual RAM, bill and latency savings depend on hosting and traffic; none have been measured as a percentage.

The availability tradeoff is explicit: the public provider catalog now shares the main API's uptime and database-dependent bootstrap. An unavailable main backend makes its exercise routes unavailable too. External provider errors remain visible with retry; no automatic fallback to fabricated data is added. Existing saved programs still avoid new provider generation when their training preferences match.

## Start locally

From the repository root, use three terminals:

```powershell
npm --prefix backend run start:dev
```

```powershell
npm run build
npm run start -- --hostname 0.0.0.0
```

```powershell
npm run expo
```

For frontend development, use `npm run dev` in the second terminal. Keep the existing backend MongoDB/JWT/provider environment configuration. LAN uses frontend port 3000 and API port 4000; Expo also needs its Metro development port. There is no listener on 4050 started by this project anymore.

For Render, see [deployment configuration](RENDER_DEPLOYMENT.md). No live deployment, account configuration or service deletion was performed. Rebuild the web client against the shared public API before retiring any manually deployed old library service.

## Verification

The HTTP integration test mounts the same library/preview controllers used by the main API in one application, with provider/storage fixtures. It verifies token-free catalog access and preview validation (including legacy weekdays), authenticated saved-program ownership, and ordinary-user denial at admin catalog routes. Its authentication fixture exercises controller guard boundaries; existing auth tests cover the real JWT implementation. Browser coverage verifies list/detail requests share the account API origin even when an obsolete separate-library address is present.

Verification passed: 360 backend tests across 46 files, 202 frontend/mobile Node checks, 57 browser checks, backend/frontend production builds and frontend/backend lint. Updated network SVGs/draw.io files were XML-validated, both PNGs were regenerated and visually inspected, and Git whitespace checks passed. Execution logs are under local `artifacts/combined-api-*`. Browser/backend integration checks use fixtures; these local results do not establish live provider/Render connectivity or Android device performance.
