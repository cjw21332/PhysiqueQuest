---
name: physiquequest-dev
description: >-
  Current development procedures for the PhysiqueQuest app and services. Use when
  changing routes, section UI, styling, local data, or the Expo WebView.
---

# PhysiqueQuest Development Procedures

**October 21, 2026 — authentication and privacy hardening (current behavior, supersedes older JWT/localStorage statements below):** Access tokens live only in memory for15 minutes. The Next same-origin `/api` rewrite forwards a rotating httpOnly refresh cookie; legacy7-day credentials remain accepted/logged until the deployed minimum-version transition finishes. Old physiquequest-auth storage is removed once and never written again. Session/version checks enforce logout/password/deletion revocation; refresh first on protected401, with one same-session retry. Existing account data caches remain non-authoritative. New signup verification is rollout-gated; old accounts are grandfathered with sensitive-action verification. Account soft deletion blocks login immediately, recovery is allowed during the30-day grace period, and resumable purge removes all owned data/objects afterward. Profile health/contact encryption requires a private HEALTH_DATA_ENCRYPTION_KEY in production. See root checklist.md and backend/PROVIDERS.md for evidence, retention and deployment obligations.


**October 21, 2026 — shared native source resolution:** `mobile/metro.config.js` adds the repository's plain `shared/` directory to Expo's default watch folders. Workspace auto-discovery covers package directories but omits this source-only folder; keep the explicit entry so native camera-readiness and rep-counter imports resolve. Restart Metro after configuration changes. `mobile/metro-config.test.mjs` guards visibility of shared imports; Android export verifies the actual bundle graph.

**October 21, 2026 — local camera readiness:** `shared/cameraReadiness.ts` owns bounded observations, cover-crop projection, independent evidence, dwell/expiry and native message validation. `useCameraReadiness` runs the browser worker or receives the fixed native readiness event; readiness state is ephemeral and never restored after close. `useCameraStream` owns camera generations/resources; blur/hidden stops clear auto-start intent, and native idle suppresses the existing LiveSession auto-start loop. Supported native builds route camera-check through `NativeTrackingCamera` with full landmarks/luminance; Expo Go keeps ordinary preview/manual fallback. Mount only one preview, retain separate rep events, keep startup deadlines until native camera configuration and invalidate old jobs. Live readiness sends no media/provider request; only explicit Upload video uses the existing provider. Calibration flags for body/brightness/framing remain false until device evidence supports them. See `.planning/phases/01-camera-readiness/01-CALIBRATION.json`; software tests do not prove hardware accuracy.

**Mandatory governing rules:** Read [GENERAL.md](./GENERAL.md) for the required checklist review, progress-report threshold, and shared repository constraints. This document governs architecture and engineering procedures; [DESIGN.md](./DESIGN.md) governs frontend design; [DATABASE.md](./DATABASE.md) governs backend and persistence. All three are mandatory.

## 1. Project State and Architecture

**October 20, 2026 — HTTP-safe workout startup:** `lib/requestKey.ts` provides idempotency IDs using randomUUID when available, getRandomValues otherwise, with a timestamp/random fallback when no crypto API exists. These IDs are not credentials. Coach stores the key and startedAt in startAttempt so retries reuse the same request. Never assume randomUUID exists on LAN HTTP/mobile WebViews. The library layout retains existing query/detail endpoints and debounced requests; equipment selection is now inside a native details disclosure.

**October 20, 2026 — Coach recovery freshness:** Recheck recovery on returning to the plan, window focus/pageshow and visible-document transitions. Verify the active candidate through a fresh detail read and require active status before showing the banner. Request generations prevent late reads from restoring stale state. Both active/detail fetches bypass browser caches. Recovery errors block new-session creation and offer retry rather than claiming there is no unfinished work.

**October 20, 2026 — frontend polish verification:** `playwright.polish.config.mjs` batches theme, auth/nutrition, calibration, routine, cache/navigation and targeted polish browser checks. The dedicated accessibility config still owns touch-emulated checks. Run browser configurations sequentially because they share the development server. Settings PUT requests use `{ values: patch }`; browser fixtures must preserve this contract. Successful profile PUT remains successful if only the optional profile localStorage write fails.

**October 20, 2026 — CSS cleanup:** The cleanup evidence is `artifacts/css-distill/cleanup-results.json` and `visual-comparison.json`; scripts in that folder record the one-off transformation/comparison, not an automatic formatter. Do not globally merge equal selectors across media queries or reorder them across competing rules. The legacy unimported `frontend/app/frontend/app/responsive-globals.css` file is deleted. Native scaling, touch minima, scoped themes and existing CSS import order remain unchanged.

**October 20, 2026 — native accessibility bridge:** `useWindowDimensions().fontScale` updates Android WebView `textZoom`; injected inset script sets iOS text-size-adjust and `data-large-text` (1.5+) for navigation reflow. Reinject on font-scale/inset changes without changing the WebView key. Native Text retains default system scaling. Connection errors use a ScrollView for large text/short screens; camera facing/retry controls have 48dp minimums. Shared web touch rules and navigation semantics remain in globals.css/BottomNav.tsx. Backend requests and app data contracts are unchanged.

**October 20, 2026 — calibration draft:** `calibrationDraft.ts` validates bounded, versioned local drafts, scoped to API base and authenticated account ID. `CalibrationFlow` restores data/current step/skipped sections before writing and persists changes locally. Registration checks the authoritative profile on recovery; existing profiles go home, missing profiles resume setup, failures offer retry/sign-in. Login routes through this recovery check. Completed profiles still use the existing POST `/profile`; only confirmed server success (including an ambiguous-response GET recovery) clears the draft. Capture/check account/API scope and token around asynchronous recovery/completion to prevent cross-account writes or cleanup. No partial profile records or new backend endpoints.

**October 20, 2026 — active routine:** `RoutineSession` composes `LiveSession` without remounting on exercise changes. `workoutRoutine.ts` builds immutable prescription snapshots. Existing revision-checked set APIs own saved work; deterministic set IDs allow active-session corrections. Local drafts are scoped by API base, account ID and workout ID. Recovery fetches authoritative active/detail records and requires explicit resume from paused state. Device checkpoints exclude the closed interval when available; without one the UI discloses that elapsed time includes the gap. No offline write queue. Completion retries retain their payload and recover a completed record after an ambiguous response. Conflict recovery adopts server pause state, stopping timers/camera/monitoring.

**October 20, 2026 — auth and nutrition hardening:** `AuthForm` owns native form submission and a pending-request guard for both login and registration. `ForgotPasswordFlow` and `AuthOutcomeModal` use the same native-dialog approach as the exercise library. Keep stage focus, opener restoration, server-issued recovery tokens, resend cooldowns, and visible errors. Nutrition's empty-state preview now requires an explicit **View sample nutrition** action and offers **Start my log**; normal meal/water controls save through existing APIs from the first record. The policy routes `/terms`, `/privacy`, and `/camera-consent` contain no policy body and are clearly marked drafts pending team review. The team content checklist is `docs/policy-review-todo.md`.

PhysiqueQuest has two root npm workspaces plus a separately managed backend service:

- frontend/ is the Next.js 16 App Router web app. React and TypeScript are used for UI and behavior; layout/component styles and scoped theme colors are in frontend/app/globals.css. The root layout also imports theme.css for the single system-wide dark palette and scrollbars.css for shared scrollbar utilities.
- mobile/ is an Expo 57 app that hosts the web app in a React Native WebView and passes native safe-area insets into CSS.
- backend/ contains the NestJS API with JWT authentication, protected profile endpoints, and MongoDB/Mongoose models. It is not a root npm workspace; install and run its package from `backend/`. Model/API code does not prove that a configured remote database is reachable.
- Nutrition, workout, quest, notification, progress, settings, and profile data have backend API/model implementations. Client-only keys include the JWT, a non-authoritative profile cache, recent-food suggestions, and an optional API URL override.
- `food-scanner/` is independently managed and is not a root npm workspace. The main backend exposes the food-scan API itself and uses its configured Gemini/USDA provider integrations; do not assume a backend-to-food-scanner service call. See DATABASE.md §10.

The web app is the source of product UI. Do not create parallel native screens in mobile/ for features that already belong to the web app.

### Current routes

| Route | Purpose |
|:--|:--|
| / | Server redirect to /launch |
| /launch | Welcome and device-readiness introduction |
| /login | Sign-in and forgot-password flow (backend-backed) |
| /register | Profile and training onboarding |
| /home | Dashboard, goals and milestones, progress, notifications, quests |
| /coach | Weekly plan, exercise library, camera check, live session, workout report |
| /scan | Nutrition overview, review estimate, add food, daily log, food history |
| /quests | Quests, level/streak progress, missions, badges, and leaderboard preview |
| /me | Profile, safety, privacy, settings, and admin tools (Exercise Library, Engagement Analytics — admin role) |
| /exercises | Public exercise library |

The five signed-in tabs are Home, Coach, Scan, Quests, and Me. Quests has its own `/quests` route and tab. The `/exercises` route serves the public exercise library. Me's exercise-management and analytics mock previews are visible to all signed-in accounts; live admin endpoints remain role-protected. Most detail screens are internal section state, not separate routes. Use the existing section controller and an explicit back callback for nested views.

### Current implementation and prototype boundaries

- Registration and login call the backend auth endpoints and store a JWT in localStorage. Registration submits the profile after onboarding; authenticated profile pages retrieve it from the backend and cache the response locally. The profile cache is not an offline source of truth.
- Password reset has request, verify, and confirm endpoints with hashed, expiring, one-time codes. EmailJS uses backend-only service/template/public keys (and an optional private key); `EMAIL_DELIVERY_URL` plus `EMAIL_DELIVERY_API_KEY` is the legacy fallback. The provider supplies email, stored account name, passcode and shared 10-minute expiry to the prepared template in backend/email-templates/otp.html. The configured EmailJS template uses that HTML and the public Cloudinary logo; send API keys cannot update the saved provider template or verify a sender domain. A no-email code response is restricted to development and must never be exposed in production.
- Nutrition (meals, water, food search, and saved scan results), workouts, progress, quests/streaks, notifications, and settings use backend API endpoints and MongoDB/Mongoose models. The recent-food picks, JWT, profile cache, and optional API URL override are client-side only; they are not authoritative copies of server data.
- Meal-photo selection opens the review screen immediately, then sends the image to the authenticated backend scan endpoint. The user reviews and saves matched scan items; scanning alone does not create a meal.
- Coach Exercise Library and public `/exercises` use API-backed search/filter/pagination, detail loading and animated GIF demonstrations. They show explicit errors and unavailable media rather than fixture fallbacks. Camera permission and local video selection use device inputs; readiness and pose analysis depend on provider availability and must not fabricate results. Workout records use the backend; selected video is previewed locally before an explicit analysis request.
- The client calls the NestJS API; the API is configured for MongoDB through server-side environment settings. Expo Go loads the frontend from the development computer and derives the API host from that page's LAN hostname. The phone and computer must share a reachable network; clients never connect directly to MongoDB.

## 2. Run and Build

Run commands from the repository root:

    npm install
    npm run dev
    npm run build
    npm run start
    npm run expo

The web development server binds to 0.0.0.0:3000 so a phone on the same network can reach it. The Expo script starts the LAN bridge; the phone and computer need network access to the web server.

The frontend uses .next-dev/ for development and .next/ for production build output. Root scripts delegate to the npm workspaces. The backend is a separate package — install and run it from `backend/`:

    cd backend && npm install && npm run start:dev

The food-scanner service is separately managed and is not part of the root npm workspaces. Follow its own README and deployment instructions; its browser client should call the main backend, whose scan implementation uses its own provider integrations.

### Tests

**Mobile startup:** The root package explicitly points `main` to `mobile/index.ts`, which registers `mobile/App.tsx`. This prevents Expo started at the repository root from falling back to `expo/AppEntry.js` and looking for a nonexistent root `App`. Prefer `npm run expo` so Expo uses the mobile workspace's app configuration. To restart with a clean Metro cache from the root, use `npm run start --workspace mobile -- --clear`.

- Mobile: run `node --test mobile/*.test.mjs mobile/inactivity/*.test.mjs` from the root. `mobile/entry.test.mjs` checks Expo's actual Android entry resolution from both the root and mobile workspace. An Android export validates bundling, not physical-device behavior.

- Frontend: run the full Node test suite with `node --test tests/*.test.mjs` from `frontend/`. `npm run test:ui-guard` runs only `mobile-redesign.test.mjs`; it is not the full suite. These tests include static source assertions and focused utility/API tests, not a browser-driven UI suite.
- Backend: `npm run test` (vitest unit + e2e in `backend/test/`), `npm run test:e2e`, `npm run lint` (oxlint).
- Use `npm run build` from the repository root for the frontend production build. Build and test the separately managed API from `backend/` when its code or API contract changes.

## 3. Find the Right Place to Change

### Routes and shells

- frontend/app/layout.tsx owns document metadata, viewport configuration, app icons, and the global stylesheet import.
- frontend/app/page.tsx sends the initial request to the server-rendered /launch route so the mobile WebView does not depend on client hydration to leave a splash page.
- frontend/app/(app)/layout.tsx guards signed-in routes.
- frontend/app/(app)/<section>/page.tsx files are thin route wrappers that load the current profile and render a section.
- frontend/app/(auth)/login/page.tsx and register/page.tsx own auth and onboarding flow composition.
- frontend/app/exercises/page.tsx is a standalone public exercise library route.
- frontend/sections/ contains feature behavior and internal subviews.
- frontend/components/ contains shared UI such as LogoutModal.
- frontend/lib/ contains persistence/auth helpers and the API client (api.ts).
- frontend/hooks/ contains the data-loading hooks (useCurrentProfile, useNutrition, useProgress, useWorkouts, useActivity, useNotifications, useSettings). Section components use these instead of calling api.ts directly.
- frontend/sections/Home/icons.tsx is the shared SVG icon registry.

Do not create routes under frontend/app/frontend/. That directory contains a legacy stylesheet, not the active route tree.

### Main section files

- Home: frontend/sections/Home/HomeSection.tsx and HomeDashboard.tsx; subviews are GoalsMilestones.tsx, Progress.tsx, and Notifications.tsx.
- Coach: frontend/sections/Coach/CoachSection.tsx controls plan, library, camera, session, and report views.
- Scan: frontend/sections/Scan/ScanSection.tsx controls nutrition, review, add, daily log, and history.
- Quests: frontend/sections/Quests Section/QuestSection.tsx (activity is backend-backed; the leaderboard is sample preview data).
- Me: frontend/sections/Me Section/MeSection.tsx.
- Me's requested admin preview entry points explicitly enable local fixtures in AdminExerciseLibrary and EngagementAnalytics. New opens an inline form page in the catalog; preview saves stay in component memory. The components default to API mode when `preview` is omitted, preserving the existing backend contract. Account/profile/settings have no sample-profile mode.
- Expo host and inset bridge: mobile/App.tsx and mobile/app.json.

## 4. Procedure: Add or Change a Signed-in Main Tab

1. Decide whether the change belongs in an existing section subview or needs a new route. Prefer internal state for a detail view that belongs to one tab.
2. For a new top-level tab, update HomeTab and tabs in frontend/sections/Home/BottomNav.tsx, add the corresponding icon to the shared registry, and create its authenticated route under frontend/app/(app)/.
3. Render the section inside the same scene and app-shell used by the other main routes. Keep route pages focused on profile loading, auth redirection, LogoutModal wiring, and the section component.
4. Implement the section UI in frontend/sections/ rather than expanding the route wrapper.
5. Add clear back behavior to nested screens. Keep the parent scroll/layout and section state in mind; return to the view the user entered from where applicable.
6. Verify the active tab path and ensure the bottom navigation remains inside the safe content frame.

## 5. Procedure: Add a Section or Internal View

1. Read the current section controller, related components, existing stylesheet rules, and DESIGN.md before editing.
2. Define a narrow TypeScript view type and keep view transitions in the section controller.
3. Pass explicit callbacks for back, save, close, and completion actions; do not make a nested view guess its parent.
4. Keep profile and section types beside their owning feature. Add data fields to the existing types rather than duplicating shapes.
5. Use the shared app content width, system font stack, color tokens, and Icon component.
6. Add an accessible page title, button labels, visible focus styles, and a responsive back control where the screen is nested.
7. Keep the section's main content in one scroll region and keep nav/action areas as separate layout items where practical.

## 6. Procedure: Style or Repair a Responsive Screen

**System-wide palette completion (October 19, 2026):** Use the exact shared tokens in theme.css and DESIGN.md on every page and overlay. Section wrappers no longer redefine colors; system-dark-theme replaces the light fallback. Keep all layout/type/flow code intact. Native loading, reconnection, permission/backend banners and camera overlays match the same palette; status/navigation indicators remain light on every dark route. Run the combined mocked browser checks with `npx playwright test --config playwright.theme.config.mjs` from frontend, plus the production build and relevant frontend/mobile tests. Palette checks inspect rendered copy, surfaces, icon color and borders, independently of OS theme. Physical-device appearance still needs device verification.

**Quests/account migration:** These routes now use `account-dark-theme` rather than the legacy light palette. Styling stays in globals.css. Validate all five editors, footer visibility, disabled/dirty state, discard/save, narrow-screen overflow and leaderboard tab/Back actions with mocked APIs. Keep the existing profile/settings services and safety behavior unchanged. This supersedes older statements that Quests and Me remain on the legacy palette.

**Latest Nutrition/safety reference pass (October 19, 2026):** Scan is dark and uses the explicitly requested reference typography/layout in scoped globals.css rules. This supersedes the older legacy-Scan and system-font restrictions below. Keep every original view transition and callback. For safety screens, change presentation only; preserve inactivity thresholds, countdown constants, alarm/native-volume code, delivery handling, hold duration and log authorization. Verify Nutrition, review, daily log, add/edit/history, narrow-width overflow, safety colors and existing safety/scan unit tests. Inspect screenshots for text contrast and run the production build. Mocked browser checks do not prove physical-device or live-provider behavior.

**Theme-only restoration policy (October 19, 2026):** Dark mode remains the default. For launch, login/register, calibration, Home, goals, progress and notifications, preserve the original layout and flow just as for Coach. Keep onboarding Back/Clear controls, unit selectors, placement validation and profile submission; keep Progress's Add measurement action in its header and measurement history beside its trend; keep Home return buttons before nested titles, notification read actions and the five-tab navigation. Auth password visibility, account feedback and recovery Close controls retain their callbacks. Keep the separately requested launch spacing and shared dark scrollbar. Theme changes must not remove functionality, move sections, change type scales or constrain the original responsive widths. All sections now inherit the shared dark palette; the system-wide color pass supersedes earlier staged legacy exceptions.

Validate a theme pass by comparing dimensions, typography and control order with the original layout, then test Back/Clear/Close/edit/save behavior with mocked APIs at narrow phone, standard phone, tablet and desktop sizes. Preserve loading/error/retry and validation states. Screenshots verify appearance; browser/build evidence does not prove a live database/provider or physical-device workflow. Do not add separate redesign stylesheets; use scoped palette rules in globals.css and the existing token/scrollbar files.

1. Reproduce the affected screen and read every definition of the relevant selectors in frontend/app/globals.css. The file has older base styles and later override layers.
2. Use Home as the reference for the shared signed-in content frame. Preserve --content-max and --content-gutter instead of adding route-specific outer widths.
3. Start with a narrow portrait layout, then ensure it adapts to short screens, landscape, tablet, laptop, and desktop. Use clamp(), minmax(0, 1fr), min-width: 0, wrapping, and local horizontal scrolling for chips where needed.
4. Respect safe-area ownership:
   - mobile/App.tsx publishes --safe-top, --safe-bottom, --safe-left, and --safe-right.
   - globals.css aliases them as --sat, --sab, --sal, and --sar with browser env() fallbacks.
   - app-shell reserves outer insets. Do not add the same inset again to a child edge.
   - Sticky/fixed content must remain inside its scroll or safe viewport and must not collide with the native status or navigation bars.
5. Choose flow behavior deliberately. Ordinary page actions such as Coach Start session belong in normal document flow. A sticky form action must reserve enough space for all preceding content and remain above the app tab bar.
6. Follow DESIGN.md for typography, touch targets, palette, borders, reduced motion, focus, and overlays.
7. Keep changes targeted and section-scoped. Do not replace globals.css wholesale or introduce a separate stylesheet.

## 7. Procedure: Add or Update Food Data

- Food and meal types live in frontend/sections/Scan/types.ts.
- The `useNutrition` hook and backend API own meal and water data; `ScanSection.tsx` coordinates scan, review, add, log, and history views.
- Add catalog records with name, group, serving description, calories, protein, carbs, and fat.
- Preserve the existing save and return flows for Add Food, Review Estimate, Today's Log, and Food History.
- Recent-food picks are cached under `physiquequest-recent-foods`; this is not the meal log.
- Photo analysis uses the backend food-scanning contract. Keep the estimate review/edit/save path explicit, handle unavailable scanner/provider errors, and do not save until the user confirms.
- Today's Log displays the live day's meals and water state, uses the shared nutrition targets, and retains the main tab bar.
- Scan’s reference presentation uses `nutritionPresentation.ts` for shared display summaries, portion scaling, and the explicitly requested sample fixtures. Preview eligibility requires a successful nutrition response with no meals or water; live records/errors take priority. Sample saves/water updates stay in section memory, never in the nutrition API or browser persistence.
- Camera and uploaded photos continue through `api.analyzeImage`; sample estimates are opened only through the explicit sample action in the photo chooser. Keep matched-item IDs and API field names when scaling portions for scan save. The backend and API client contracts were not changed for the visual redesign.
- Food History retains the main tab bar and opens from either Nutrition or Today’s Log, returning to its caller. Internal view changes start at the top of the shared content region. Add Food and Review Estimate retain sticky save footers and hide the tab bar.

## 8. Procedure: Update Coach Exercises or Workout Flows

**October 19, 2026 clarification:** Preserve the existing Coach layouts and view callbacks when changing themes. The `coach-dark-theme` wrapper applies color overrides from `globals.css`; it must not inherit the Home redesign's widths, spacing, fonts or hidden-back-button rules. The current Exercise Library uses API-backed catalog/detail/GIF requests. Plan, library, camera/upload, session and report retain their original control placement. Back buttons precede nested page titles; Library/Camera/Report return to the plan, and End session completes the active workout before the report opens. Theme work must preserve camera, upload, workout persistence, pause/resume, and inactivity-alarm behavior.

- `useCoachPlan` retrieves the saved account program; `ExerciseLibrary.tsx` requests the catalog and exercise details through the existing API client. Preserve the saved program's exercise IDs/prescriptions, catalog filter defaults, pagination and provider attribution.
- The Coach library retains BottomNav; exercise details use a native modal dialog above it. Search/filter requests, detail loading and GIF play/pause preserve their current behavior. Keep Close/Escape dismissal and focus restoration. Temporary UI verification routes must be removed before delivery.
- The library entry remains available on rest days and while the weekly plan loads or fails; preserve the plan's actual loading/error messages and retry control.
- CoachSection.tsx owns internal view state; its current flow is plan -> library or camera -> live session -> workout report.
- Exercise tags are AI tracked, Manual, and Caution. These are labels in the prototype and do not imply real model tracking.
- Use the supplied callbacks to return to the plan or finish a workout. Do not create a parallel route for an internal Coach view unless the product structure changes.
- Camera preview and video selection use device inputs. Readiness checks use the configured pose service when available; missing analysis stays explicitly unavailable. Theme changes do not alter provider requests or enable hidden camera-counting previews.

## 9. Procedure: Update Persistence or Authentication

Current localStorage keys:

| Key | Stored data | Owner |
|:--|:--|:--|
| physiquequest-auth | Backend user identity and JWT access token; never the password | frontend/lib/auth.ts |
| physiquequest-profile | Cached backend profile; it is not the authoritative copy | frontend/hooks/useCurrentProfile.ts and signed-in route wrappers |
| physiquequest-recent-foods | Recently selected food suggestions; not meal history | frontend/sections/Scan/AddFood.tsx |
| physiquequest-runtime-api-url | User-overridable API base URL (LAN address fallback) | frontend/lib/api.ts |

Ephemeral client-side state that is NOT persisted (in-memory or event-driven):

| State | Owner |
|:--|:--|
| physiquequest-device-readiness | Custom event published by mobile/App.tsx; consumed by launch/page.tsx |
| deviceCache subscribers | Shared confirmed-response updates consumed by useAppResource/useNutrition/useActivity/useCoachPlan/useCurrentProfile |
| physiquequest:session-ended | Logout/401 event; clears visible resources and redirects the signed-in layout |

Rules:

- Guard browser-only storage access from server rendering and catch malformed JSON where practical.
- Never store passwords or secrets in localStorage.
- Route auth checks use the shared functions in frontend/lib/auth.ts.
- Logout removes the auth key and legacy unscoped profile key. The versioned device snapshot can be restored after a subsequent login to the same account/API server; protected API requests still require a bearer token.
- Do not store passwords in localStorage or describe the profile cache as authoritative or an offline mode. Nutrition, workout, quest, notification, progress, and settings data are served by the backend API and are not local-only features.
- When the backend updates data, prefer a custom event or hook refresher over writing a parallel local copy that could diverge from the server.

### Cached startup data

Main tabs and signed-in section shortcuts/back actions use `useRouter().push`; BottomNav prefetches the five tab routes and ignores clicks on the current route. Auth/login/logout navigation still uses the shared full-document helper. `useAppResource` restores cached data in a layout effect before paint; large loading-profile/section messages have been replaced by accessible cold-load placeholders. Do not restore full-page reloads inside signed-in navigation. Next.js `devIndicators` is disabled so its badge cannot intercept Me-tab taps.

The signed-in layout starts profile, nutrition, activity and Coach reads together. `useAppResource` displays the last confirmed response while revalidating; the shared API/cache layer deduplicates consumers and updates them after confirmed writes. `physiquequest-device-cache-v1` is bounded, expires and is scoped to one account/API server. A status notice distinguishes saved data from a successful refresh. This replaces the former profile-only loading gate; MongoDB remains authoritative and writes require API confirmation. See [backend.md](./backend.md) for lifecycle, invalidation and separate API/Coach build outputs.

## 10. Procedure: Change the Native WebView

1. Keep product UI in the web app unless implementing a native-only capability such as the connection fallback.
2. Check mobile/App.tsx for viewport, keyboard, camera/media playback, error/loading, and inset behavior before changing WebView props.
3. If safe-area behavior changes, update the injected custom properties and matching CSS aliases together.
4. Check mobile/app.json for platform orientation, edge-to-edge, status-bar, navigation-bar, and icon configuration.
5. Keep the development WebView URL reachable over the local network; default port is 3000.

## 11. Verification and Accessibility

After a UI, route, or behavior change:

- Run `npm run build` from the root and resolve TypeScript, CSS parsing, and static route errors.
- Run the backend tests (`cd backend && npm run test`) when the change touches API contracts, schemas, or persistence.
- Run the relevant frontend test(s), and use `node --test tests/*.test.mjs` from `frontend/` for the full frontend suite when a section component or shared flow changes.
- Review the changed screen at a narrow phone width, a short-height phone, tablet width, and desktop width when the change affects responsive behavior.
- Check that no control overlaps the status bar, cutout, system navigation, or app bottom tabs.
- Check that primary touch targets remain at least 44px, back buttons return to the correct parent view, and inputs remain usable with a mobile keyboard.
- Respect prefers-reduced-motion and provide accessible labels/focus states.
- Do not claim that device-level behavior was verified unless it was run on a device.

## 12. Procedure: Keep the Rule Docs in Sync

The rule docs are a contract with the codebase, and they have drifted before. Make sure they cannot drift again.

1. **When the system changes, the relevant rules change with it.** Update every affected domain document, and update the other two when the change affects their responsibilities. Do not make unrelated edits just to touch all documents.
2. **State the current behavior, not the planned one.** Write what is implemented. If a feature is a prototype, a demo, or not yet connected, say so explicitly — do not describe sample data as live data or vice versa.
3. **Before editing a rule doc, verify against the live system.** Check the actual backend modules, schemas, routes, and env config; the actual frontend hooks, sections, and localStorage keys; and the actual versions in package.json. Do not edit a rule doc from memory.
4. **When a doc is stale, fix the doc — never the code to match a stale rule.** If the rules contradict the system, the system is right; update the rules and record what changed.
5. **Keep each doc in its lane.**
   - `GENERAL.md` — mandatory shared governance, checklist maintenance, progress reports, and project-wide guardrails.
   - `DATABASE.md` — persistence state and language-independent database/backend data rules.
   - `DESIGN.md` — frontend visual and interaction rules, including loading, empty, and error states and sample/demo labeling.
   - `PROCEDURES.md` — current architecture and how to make changes safely.
   - `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` — locked project rules (Next.js version, monorepo structure, styling constraints). These are edited only when the stack itself changes.
6. **Version the design doc when the interface changes.** Bump the DESIGN.md title and record the user-visible change in its maintenance section.

## 13. Documentation Updates

- Follow [GENERAL.md](./GENERAL.md) after every task: recheck `docs/checklist.md`, update evidence/status where warranted, and create the next numbered progress report for substantial work.
- Keep DESIGN.md focused on visual and interaction rules.
- Keep PROCEDURES.md focused on current architecture and how to make changes safely.
- Keep DATABASE.md focused on current persistence state and language-independent database/backend data rules.
- Update each of the three domain documents when the change affects its scope; cross-layer architecture changes may affect multiple documents.
- Keep README.md's quick-start and folder overview aligned with the actual npm workspaces and separately managed backend service.
