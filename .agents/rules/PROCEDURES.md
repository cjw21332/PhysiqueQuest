---
name: physiquequest-dev
description: >-
  Current development procedures for the PhysiqueQuest prototype. Use when
  changing routes, section UI, styling, local data, or the Expo WebView.
---

# PhysiqueQuest Development Procedures

## 1. Project State and Architecture

PhysiqueQuest has two root npm workspaces plus a separately managed backend service:

- frontend/ is the Next.js 16 App Router web app. React and TypeScript are used for UI and behavior; all active global styles are in frontend/app/globals.css.
- mobile/ is an Expo 57 app that hosts the web app in a React Native WebView and passes native safe-area insets into CSS.
- backend/ is an operational NestJS API service with JWT authentication, protected profile endpoints, and a MongoDB/Mongoose connection. It is not a root npm workspace; install and run its package from `backend/`.
- MongoDB Atlas stores user identities and profiles. Nutrition, workout, quest, notification, progress, and settings state are now served by the backend API (real collections, not localStorage). Only a few client-side caches and the food log's recent-foods cache remain local.
- `backend/` is a separately managed NestJS service (not a root npm workspace); install and run it from `backend/`. `food-scanner/` is an internal-only external service with its own repo and workspace; the backend calls it over a private network with a shared secret. See DATABASE.md §10.

The web app is the source of product UI. Do not create parallel native screens in mobile/ for features that already belong to the web app.

### Current routes

| Route | Purpose |
|:--|:--|
| / | Server-side redirect to /launch so the Expo WebView does not depend on client hydration to leave a splash page |
| /launch | Welcome and device-readiness introduction |
| /login | Prototype sign-in and forgot-password flow |
| /register | Profile and training onboarding |
| /exercises | Public exercise library (standalone route, not inside a tab) |
| /home | Dashboard, goals and milestones, progress, notifications |
| /coach | Weekly plan, exercise library, camera check, live session, workout report |
| /scan | Nutrition overview, review estimate, add food, daily log, food history |
| /quests | Level, streak, daily missions, penalties, badges, leaderboard |
| /me | Profile, safety, privacy, and settings |

The five main signed-in tabs are Home, Coach, Scan, Quests, and Me. Most secondary views are internal section state, not separate routes. Use the existing section controller and a back callback for nested views. The `/exercises` page is a standalone public route outside the tab shell.

### Current prototype boundaries

- Registration and login call the backend auth endpoints and store a JWT in localStorage. Authenticated profile pages retrieve profile data from the backend and cache the response locally.
- Password reset is fully implemented: request + confirm endpoints, `password_recovery_tokens` collection, token hashing, expiry, and one-time use.
- Food log data is saved locally; exercise, progress, quest, notification, and nutrition data come from the backend API (not sample/demo). Only the recent-foods cache remains local.
- Coach exercise library is fetched from `GET /exercises` with a static fallback in `exercises.ts`. Camera permission and local video selection can use device inputs, but readiness checks, form tracking, calorie estimates, exercise scoring, and workout reports are prototype/demo behavior. Do not describe these results as connected AI or verified tracking. Uploaded video is currently handled locally in the WebView flow.
- The client calls the NestJS API; the API connects to MongoDB Atlas. Expo Go loads the frontend from the development computer and derives the API host from that page's LAN hostname. The phone and computer must share a reachable network; clients never connect directly to Atlas.

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

The food-scanner service is separate again (`cd food-scanner && npm install && npm run dev`); it is not part of the PhysiqueQuest workspaces and only the backend talks to it.

### Tests

- Frontend: `npm run test:ui-guard` (node:test static source assertions in `frontend/tests/`). There is no runtime browser or unit-test suite.
- Backend: `npm run test` (vitest unit + e2e in `backend/test/`), `npm run test:e2e`, `npm run lint` (oxlint).
- Use the production build (`npm run build`) to check TypeScript and route compilation after frontend code changes.

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
- Quests: frontend/sections/Quests Section/QuestSection.tsx (leaderboard is hardcoded preview data — labeled as sample).
- Me: frontend/sections/Me Section/MeSection.tsx.
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

- Food types and sample values live in frontend/sections/Scan/types.ts.
- ScanSection.tsx owns the food-log state and persistence.
- Add catalog records with name, group, serving description, calories, protein, carbs, and fat.
- Preserve the existing save and return flows for Add Food, Review Estimate, Today's Log, and Food History.
- The food log storage key is physiquequest-food-log with a meals array and water count. Validate parsed data before using it; retain a usable fallback if browser storage is empty or malformed.
- Keep demo estimate and nutrition copy clear about its sample-data status.

## 8. Procedure: Update Coach Exercises or Workout Flows

- Exercise records and filter values live in frontend/sections/Coach/exercises.ts.
- CoachSection.tsx owns internal view state; its current flow is plan -> library or camera -> live session -> workout report.
- Exercise tags are AI tracked, Manual, and Caution. These are labels in the prototype and do not imply real model tracking.
- Use the supplied callbacks to return to the plan or finish a workout. Do not create a parallel route for an internal Coach view unless the product structure changes.
- Camera preview and video selection can use device inputs. Readiness results, form scores, and live workout feedback are demo behavior; no AI analysis service is connected.

## 9. Procedure: Update Persistence or Authentication

Current localStorage keys:

| Key | Stored data | Owner |
|:--|:--|:--|
| physiquequest-auth | Backend user identity and JWT access token; never the password | frontend/lib/auth.ts |
| physiquequest-profile | Cached backend profile; it is not the authoritative copy | frontend/hooks/useCurrentProfile.ts and signed-in route wrappers |
| physiquequest-recent-foods | Recently added food entries (the only food-log data still local) | frontend/sections/Scan/AddFood.tsx |
| physiquequest-runtime-api-url | User-overridable API base URL (LAN address fallback) | frontend/lib/api.ts |

Ephemeral client-side state that is NOT persisted (in-memory or event-driven):

| State | Owner |
|:--|:--|
| physiquequest-device-readiness | Custom event published by mobile/App.tsx; consumed by launch/page.tsx |
| physiquequest-nutrition-updated | Custom event fired after a meal/water change; consumed by useNutrition |
| physiquequest-profile-updated | Custom event fired after a profile update; consumed by useCurrentProfile |

Rules:

- Guard browser-only storage access from server rendering and catch malformed JSON where practical.
- Never store passwords or secrets in localStorage.
- Route auth checks use the shared functions in frontend/lib/auth.ts.
- Logout removes the auth key and leaves the profile cache intact. Protected pages must still obtain profile data from the API using the bearer token.
- Do not store passwords in localStorage or describe the profile cache as authoritative or an offline mode. Nutrition, workout, quest, notification, progress, and settings data are served by the backend API and are not local-only features.
- When the backend updates data, prefer a custom event or hook refresher over writing a parallel local copy that could diverge from the server.

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
- Run the frontend UI-guard tests (`npm run test:ui-guard`) when a section component changes.
- Review the changed screen at a narrow phone width, a short-height phone, tablet width, and desktop width when the change affects responsive behavior.
- Check that no control overlaps the status bar, cutout, system navigation, or app bottom tabs.
- Check that primary touch targets remain at least 44px, back buttons return to the correct parent view, and inputs remain usable with a mobile keyboard.
- Respect prefers-reduced-motion and provide accessible labels/focus states.
- Do not claim that device-level behavior was verified unless it was run on a device.

## 12. Procedure: Keep the Rule Docs in Sync

The rule docs are a contract with the codebase, and they have drifted before. Make sure they cannot drift again.

1. **When the system changes, the rules change with it.** Any change to architecture, routes, navigation, palette, safe-area handling, persistence, supported workflows, backend modules, or external services must update DATABASE.md, DESIGN.md, and PROCEDURES.md in the same change.
2. **State the current behavior, not the planned one.** Write what is implemented. If a feature is a prototype, a demo, or not yet connected, say so explicitly — do not describe sample data as live data or vice versa.
3. **Before editing a rule doc, verify against the live system.** Check the actual backend modules, schemas, routes, and env config; the actual frontend hooks, sections, and localStorage keys; and the actual versions in package.json. Do not edit a rule doc from memory.
4. **When a doc is stale, fix the doc — never the code to match a stale rule.** If the rules contradict the system, the system is right; update the rules and record what changed.
5. **Keep each doc in its lane.**
   - `DATABASE.md` — persistence state and language-independent database/backend data rules.
   - `DESIGN.md` — visual and interaction rules, plus backend-integration design concerns (loading, empty, and error states; sample/demo labeling).
   - `PROCEDURES.md` — current architecture and how to make changes safely.
   - `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` — locked project rules (Next.js version, monorepo structure, styling constraints). These are edited only when the stack itself changes.
6. **Version the design doc when the interface changes.** Bump the version in the DESIGN.md title (currently v2.2) and note the change in the maintenance section.

## 13. Documentation Updates

- Keep DESIGN.md focused on visual and interaction rules.
- Keep PROCEDURES.md focused on current architecture and how to make changes safely.
- Keep DATABASE.md focused on current persistence state and language-independent database/backend data rules.
- Update all three when app structure, navigation, palette, safe-area handling, persistence, or supported workflows change.
- Keep README.md's quick-start and folder overview aligned with the actual npm workspaces and separately managed backend service.
