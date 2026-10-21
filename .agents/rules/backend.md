---
name: physiquequest-backend
description: Use when changing PhysiqueQuest backend APIs, mobile data loading, cached responses, database reads, or service startup.
---

# Backend and mobile data loading

**October 21, 2026 — authentication and privacy hardening (current behavior, supersedes older JWT/localStorage statements below):** Access tokens live only in memory for15 minutes. The Next same-origin `/api` rewrite forwards a rotating httpOnly refresh cookie; legacy7-day credentials remain accepted/logged until the deployed minimum-version transition finishes. Old physiquequest-auth storage is removed once and never written again. Session/version checks enforce logout/password/deletion revocation; refresh first on protected401, with one same-session retry. Existing account data caches remain non-authoritative. New signup verification is rollout-gated; old accounts are grandfathered with sensitive-action verification. Account soft deletion blocks login immediately, recovery is allowed during the30-day grace period, and resumable purge removes all owned data/objects afterward. Profile health/contact encryption requires a private HEALTH_DATA_ENCRYPTION_KEY in production. See root checklist.md and backend/PROVIDERS.md for evidence, retention and deployment obligations.


Read with [GENERAL.md](./GENERAL.md), [DATABASE.md](./DATABASE.md), and [PROCEDURES.md](./PROCEDURES.md). This is the requested project rule file for future backend changes.

## Ownership

- The main NestJS API owns user data in MongoDB. Derive ownership from JWT claims; a cached ID or device snapshot never grants access.
- The Next.js client also runs in the Expo WebView. Device caching belongs in this shared client; a server cache cannot display data before a network round trip.
- Reuse domain services and React hooks. Do not add Redux, another database, caching dependencies or microservices to solve request waterfalls.
- Await server confirmation for writes. Do not queue mutations, fabricate saves, or trust cached quest credit, completed workouts, permissions or safety settings.

## Current snapshot contract

- `frontend/lib/deviceCache.mjs` and `frontend/lib/api.ts` own profile, nutrition, activity/quests and saved Coach-plan snapshots. Home derives its display from them.
- `physiquequest-device-cache-v1` retains only the last account's snapshot, scoped to account and API address. Store response data and timestamps, never another copy of the JWT or credentials.
- Persist at most 512,000 bytes per resource, about 2 MB total. Larger successful responses remain available in memory; storage failures must not break API saves.
- Expire snapshots after seven days and daily missions at the next local date. Select today's water from dated records rather than yesterday's cached counter.
- `useAppResource` restores saved data and subscribes consumers. The signed-in layout starts all four reads together; update sections independently so a slow Coach does not block Profile or Nutrition.
- Signed-in section navigation uses Next.js client routing and tab route prefetching. Do not reintroduce `window.location.assign` for tab switches: it discards the running app and its in-memory cache. Auth/login/logout boundaries may still hard-redirect. Hydrate cached resources in the layout effect before paint; cold loads use quiet accessible placeholders, with error/retry preserved.
- Share concurrent identical requests; reuse recently confirmed reads for 15 seconds. Explicit Refresh bypasses that freshness window.
- Confirmed nutrition writes replace nutrition and invalidate activity. Workout writes invalidate activity. Profile writes replace profile and invalidate Coach; settings writes invalidate Coach. Extend invalidation when adding dependencies.
- Preserve revision and session checks: old reads must not overwrite confirmed writes, a newly selected API server or another account.
- Logout/401 clears credentials, the legacy unscoped profile key and visible cached state, then leaves protected routes. A later login to the same account/server may restore the snapshot. Browser storage is not encrypted or tamper-proof.
- Label saved data during refresh and background failures. Cache availability is not an offline write mode; API validation and confirmed saves remain mandatory.

## Efficient reads

- Parallelize independent reads with `Promise.all`/`allSettled` as appropriate. Preserve dependencies, authorization, deadlines and partial failure handling.
- Use GET for reads. Quests use `GET /activity/state?timezone=...`; opening a screen must not write a timezone document each time.
- Coach reads profile/settings concurrently and restores the existing per-user program when its context hash matches. Do not regenerate unchanged plans or call ExerciseDB on every navigation.
- Prefer lean queries, narrow projections, bounded pagination and indexes matching actual filters. Measure slow paths before adding a server cache or changing schemas.
- Keep public catalog caching separate from user data. Never cache private responses in an unscoped global map or public HTTP cache.
- Read deadlines can preserve a cached display; write retries/timeouts need care because a timed-out write may already have committed.

## Runtime and verification

- `backend/` is a separate npm package. API watch uses `tsconfig.dev.json` → `dist-dev`; Coach watch uses `tsconfig.coach.json` → `dist-coach`; production builds use `dist`. Keep incremental metadata separate.
- Run one API listener on 4000 and one standalone Coach on 4050. Inspect owners before restarting; stop only identified project processes. Do not leave extra verification servers occupying the user's ports.
- Test expiry, malformed/quota-blocked storage, user/server isolation, logout races, read deduplication, failed refreshes and writes racing reads. Browser mocks prove UI behavior, not real database persistence or physical-device speed.
- Run relevant frontend tests/build and backend tests/build/lint. Report skipped provider, device or database checks accurately.
