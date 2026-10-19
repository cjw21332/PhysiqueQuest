# Device snapshots and parallel startup — October 19, 2026

## Delivered behavior

- Returning users can see the last confirmed profile, nutrition, daily missions and saved Coach recommendations while the app revalidates. Home derives its summary from those shared resources. This applies to the web client and its Expo WebView host.
- The signed-in layout starts four independent authenticated reads concurrently, avoiding the old profile-first waterfall. Consumers share in-flight reads and a short 15-second freshness window; each section updates without waiting for the others.
- `frontend/lib/deviceCache.mjs` owns one versioned last-account snapshot, scoped to user ID and API address. It persists at most 512,000 bytes per resource, about 2 MB total, and expires after seven days; daily missions expire at the next local date. Oversized data stays usable in memory. Broken, invalid, unavailable or quota-limited storage does not fabricate success or break API delivery.
- Nutrition mutations update the cached server response and invalidate Activity. Workout writes invalidate Activity. Profile mutations update Profile and invalidate Coach; settings writes invalidate Coach. Revision/session checks prevent stale reads from replacing confirmed writes or contaminating another account/API server.
- Shared hooks retain saved data on background errors, and a shell notice explains saved/refreshing/failed states with Refresh. First-load failures retain existing error/retry screens. Logout/401 clears active presentation and legacy unscoped profile data. The last snapshot may be reused after the same account signs in again.
- Resource reads refresh on focus/visibility/online behavior. Daily polling checks expiry. Snapshot storage events are ignored to prevent cross-tab network feedback; auth changes still clear/redirect another tab.
- Quests now reads the timezone-specific GET endpoint rather than writing activity state on every screen load. Backend Coach reads profile/settings concurrently while retaining existing persisted program versioning and validation.
- Added the requested `.agents/rules/backend.md`, linked it from GENERAL.md, and aligned DATABASE.md, PROCEDURES.md, DESIGN.md and the checklist.

## Scope and implementation

No new dependency, database schema, server-side snapshot collection, offline mutation queue, auth change, microservice split or public cache was added. A server cache alone cannot render data before a network round trip; the device cache therefore lives in the existing shared client/API layer. MongoDB remains authoritative. Safety settings still load through their existing live API path.

Key files: `frontend/lib/deviceCache.mjs`, its type declaration, `frontend/lib/api.ts`, `frontend/hooks/useAppResource.ts`, the four resource hooks, `frontend/lib/session.ts`, the signed-in layout/cache notice styles, and `backend/src/coach/coach.service.ts`.

## Verification

- New cache tests were run before implementation and failed because the module did not exist. Cache tests cover restart restoration, account/API/session isolation, read deduplication, stale writes/read races, invalidation, offline failures, TTL/daily expiry, schema checks, quota failure and parallel independent resolution.
- A hook-level regression confirms old Coach responses cannot overwrite an invalidated/reloaded plan. A backend test confirms settings reads begin before the profile promise resolves.
- Backend suite: 372 tests across 47 files passed. Backend build and lint passed.
- Frontend production build and TypeScript checks passed. Full frontend Node suite: 113/114; the sole failure is the preexisting `meal-edit.test.mjs` assertion expecting “No logged yet” while the existing UI renders “Not logged yet”. That unrelated wording/test was left intact.
- Mocked browser checks: 7/7 cache/Coach tests passed. They cover concurrent startup before Profile resolves, deduplication, cached Home/Coach/Scan/Quests, independent fresh replacement, offline saved views, another account, 401 redirect, confirmed water persistence through reload, cross-tab request stability and cross-tab logout. Navigation/overflow checks cover 320/390/768/1440 widths.
- Existing journey browser tests: 6/6 passed, covering Home, goals, progress, notifications and Scan interactions.
- A separate review found cross-tab refresh loops, cross-tab logout navigation and failed-refresh daily rollover issues; all were fixed and rechecked with no important residual findings.
- Existing API/Coach listeners responded on 4000/4050 after builds; no extra runtime server was started. `git diff --check` passed.

## Limits

No physical mobile-device latency measurement, deployment, real inbox send or new genuine-account/database mutation journey was performed. Browser integration evidence uses synthetic API fixtures. This is a display cache, not an offline write/sync system; actions still need the server. Device storage is not encrypted. No commit or push was made.
