# PhysiqueQuest v3.0.0

PhysiqueQuest is a fitness app for planning workouts, logging sets, tracking progress and reviewing locally counted exercise videos. It uses a Next.js interface, an Expo Android WebView shell, one shared NestJS backend and MongoDB persistence.

This branch brings together the workout improvements, expanded exercise guides, configurable rep counter, shared backend and account-security fixes. See the [v3.0.0 change summary](docs/RELEASE-v3.0.0.md).

## Current features

- **Workout sessions:** Start set and Done set prompts, pause/continue, recovery after reload, skipped/completed/remaining sets, and saved recordings. Results stay tied to their account, program and scheduled date rather than appearing on every weekday.
- **Connected progress:** Saved sessions update history, activity, goals, quests and leaderboard data through API-backed resources and refresh notifications.
- **Exercise guides:** ExerciseDB demonstrations and instructions, 50 built-in PhysiqueQuest manual guides, and 609 attributed RepDB guides with still illustrations. Sources are browsed separately; guide availability does not imply automatic tracking support.
- **Local rep counting:** 27 selectable presets across 12 movement families, including push-ups, hinges, glute bridges and stationary lunges. Uploaded videos can suggest five supported generic exercise families; users review and correct results before saving or applying them to a planned set.
- **Account security:** Me-page password changes send a six-digit code only to the signed-in account's registered email. The backend binds verification and confirmation to that account and rejects alternate destinations or another account's authorization. Successful changes revoke prior sessions. Signed-out recovery has its own flow.
- **Personal tracking:** Profiles, preferences, nutrition logs, progress measurements, notifications and saved Coach programs use backend persistence. Photo-based food identification and nutrient lookup require their configured providers.
- **Administration:** Administrator-only exercise creation, editing, publication and deletion, plus API-backed engagement analytics.
- **Foreground safety:** Monitoring pauses when Android is locked or backgrounded, shows a paused notice and requires explicit resume. Alert delivery requires a configured provider.

## Architecture

| Component | Responsibility |
|---|---|
| `frontend/` | Next.js/React screens, API client, local video worker and lazy-loaded RepDB guides. |
| `mobile/` | Expo WebView shell, connection recovery and native camera/sensor bridges. |
| `backend/` | One NestJS API for accounts, workouts, public exercise browsing, Coach plans, administration and configured providers. |
| `shared/` | Workout contracts, configurable movement rules and optional pose-classifier tooling. |
| MongoDB | Application persistence, saved programs, request-bound password authorizations and shared auth limits. |

**The exercise library runs inside the main backend.** There is no separate library process to start. Library and account requests share the API address and provider request pacing. RepDB guides are loaded separately in the frontend. Public guides remain public; personal and administrator routes enforce their respective access rules.

Pose inference and video decoding run on the user's device. Reviewed exercise/count results are saved through the API; this workflow does not send video frames to a remote pose service. The library now shares the main API's uptime and database-dependent startup.

See the [shared API explanation](docs/COMBINED_API.md), [deployed Android network layout](docs/NETWORK_LAYOUT.md) and [LAN layout](docs/NETWORK_LAYOUT_LAN.md). Editable Mermaid and draw.io diagrams are included.

## Install and configure

From the project root:

```powershell
npm install
npm --prefix backend install
```

Create `backend/.env` from [backend/.env.example](backend/.env.example) if it does not already exist. Configure:

- `MONGODB_URI`: MongoDB Atlas or another MongoDB deployment supporting transactions. Password recovery/change transactions require a replica set; a plain standalone MongoDB instance is insufficient.
- `JWT_SECRET`: a strong private signing secret.
- `FRONTEND_URL`: the allowed frontend origin, normally `http://localhost:3000` for local development.
- Email delivery credentials for working recovery/password-change codes; food-scan and safety-delivery settings for those features.

Keep credentials in backend environment files. Client `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values must contain public connection settings only.

On a clean frontend start/build, the preparation hook fetches the pinned RepDB snapshot and creates an ignored display module. Internet access to Hugging Face is required for this preparation. The generated catalog and research files must remain outside Git and public dataset/API exports.

## Run locally

Open **three terminals** in the project root.

**Terminal 1 — shared backend, port 4000:**

```powershell
npm --prefix backend run start:dev
```

**Terminal 2 — frontend, port 3000:**

```powershell
npm run dev
```

**Terminal 3 — Expo Go:**

```powershell
npm run expo
```

For an optimized frontend preview, replace Terminal 2's command with:

```powershell
npm run build
npm run start -- --hostname 0.0.0.0
```

The former `npm run coach` and `npm run coach:dev` scripts are retired. No port-4050 service is needed.

### Open on Android

Connect the phone and computer to the same Wi-Fi, then scan the Expo QR code. The shell normally derives the computer's LAN address, loads the frontend on port 3000 and uses the shared API on port 4000. It reports frontend/backend connectivity separately and offers manual address recovery. An Expo tunnel carries the Expo bundle; it does not expose frontend/API ports automatically.

Expo Go supports the WebView app. The native live-camera pose bridge requires an Android development build with the required native modules; it is not available through Expo Go alone. See [camera setup and limitations](docs/CAMERA_TRACKING.md) and [running instructions](RUNNING.md).

For hosted connections, configure the frontend's `NEXT_PUBLIC_API_URL` and the Android shell's `EXPO_PUBLIC_WEB_APP_URL` / `EXPO_PUBLIC_API_URL`. The retired `NEXT_PUBLIC_COACH_API_URL` and separate-library runtime override are no longer read. Rebuild the frontend when changing build-time connection values.

## Rep counting and research status

Counting rules are experimental. The 27 presets include equipment variations and cover 12 movement families; they are not 27 independently trained exercise recognizers. Automatic suggestions currently cover squat, curl, push-up, overhead press and lateral raise. Newer families require explicit selection and a suitable camera view. Manual logging and reviewed corrections remain available.

The shared engine centralizes posture gates, thresholds, timing and landmark selection. New families can use estimated MediaPipe world-coordinate angles when available. These estimates are not calibrated motion-capture measurements, and synthetic tests do not establish real-person accuracy.

Offline pose-classifier training/evaluation tools are prepared, but **no trained production classifier is enabled**. RepDB provides guides and still illustrations rather than labeled repetition videos. The separate Qualcomm benchmark workflow is for internal research evaluation: one real video has been extracted successfully, but no manually verified segments have yet been scored. It cannot currently establish rep-count accuracy or justify shipping a trained model under its research-only terms.

See [counter architecture](docs/CONFIGURABLE_COUNTER.md), [counting presets](docs/REP_COUNTER_EXPANSION.md) and [Qualcomm research workflow](docs/QEVD_RESEARCH.md). Suitable deployment-compatible motion data, reviewed ground truth and physical-device evaluation remain required.

## Validation

Latest recorded verification on **October 18, 2026**:

| Check | Result |
|---|---|
| Backend automated suite | 370 passed across 47 files. |
| Frontend/mobile Node checks | 202 passed. |
| Browser integration checks | 58 passed. |
| Isolated MongoDB recovery/change transaction checks | 2 passed; mocked email and synthetic accounts. |
| Frontend/backend production builds and lint | Passed. |
| Earlier Android Hermes export and mobile type checks | Passed; not a signed installation or physical-device accuracy test. |

These are recorded development checks, not a live production certification. Browser/provider contracts use fixtures; the MongoDB transaction checks use a separate randomly named test database with guarded cleanup.

Common verification commands:

```powershell
npm --prefix backend test
node --test frontend/tests/*.test.mjs mobile/*.test.mjs mobile/inactivity/*.test.mjs
npm run build
npm run test:browser --workspace frontend
```

Browser tests use port 3221 and the installed Chrome executable by default on Windows; other environments can set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Database integration tests are opt-in; see the [password-change report](docs/PASSWORD_CHANGE_FIX.md) before running them against an isolated test setup.

## Deployment and remaining work

[render.yaml](render.yaml) prepares **two Render services**: the Next.js web app and shared NestJS API. It does not create services or configure domains by itself. [Android build profiles](mobile/eas.json) and release URL guards are prepared; hosting, signing and publication still need configuration and verification.

Remaining release work includes physical Android camera/counting and performance testing, verified motion labels and training-data rights, controlled live-provider checks, signed-app installation and Render staging/rollback verification. The last recorded dependency audit also retains Expo/tooling findings documented in the [dependency report](docs/DEPENDENCY_AUDIT_2026-10-18.md); that snapshot is not a fresh audit or release clearance.

See [Render and Android deployment](docs/RENDER_DEPLOYMENT.md) and the [functionality checklist](docs/checklist.md). Older checklist entries and progress reports describe historical states; current change reports supersede the retired separate-library architecture.

## Data sources and attribution

- Exercise data by [RepDB (repdb.co)](https://repdb.co). The in-app guide source uses its free-tier snapshot with visible attribution; see [integration and distribution scope](docs/REPDB_LIBRARY.md). Generated collection files are not committed or offered as a standalone dataset/API.
- ExerciseDB data and GIFs are supplied by [AscendAPI / ExerciseDB](https://oss.exercisedb.dev). Provider attribution and usage restrictions are documented in [the Coach guide](docs/AI_COACH.md).
- The Qualcomm benchmark is kept separate for research evaluation, with its source, pinned revision and license described in [the research guide](docs/QEVD_RESEARCH.md). Research data and derived pose files remain ignored and are not bundled into the app.

## Documentation

- [v3.0.0 change summary](docs/RELEASE-v3.0.0.md)
- [Shared backend and migration](docs/COMBINED_API.md)
- [Account-bound password changes](docs/PASSWORD_CHANGE_FIX.md)
- [Daily workout progress and session controls](docs/COACH_DAY_PROGRESS.md)
- [Database ERD](docs/ERD.md) and [data dictionary](docs/DATA_DICTIONARY.md)
- [Deployed Android network](docs/NETWORK_LAYOUT.md) and [LAN network](docs/NETWORK_LAYOUT_LAN.md)
- [Functional audit](docs/FUNCTIONAL_AUDIT_2026-10-18.md) and [remediation results](docs/REMEDIATION_2026-10-18.md)
- [Earlier v2.7.4 notes](docs/RELEASE-v2.7.4.md) and [historical progress reports](ProgressReports/)
