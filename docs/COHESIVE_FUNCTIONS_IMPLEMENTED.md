# Connected feature implementation — October 17, 2026

This records the local implementation of [the research plan](COHESIVE_FUNCTIONS_PLAN.md). No production deployment or live database migration was run from this chat.

## What now connects

- Coach creates a workout with ordered exercise snapshots, prescribed set counts, selected program version/day, timezone, and a stable creation key. The workout has its own `/workouts/[id]` route.
- The session runner visits every exercise/set. Users can log reps and optional load, log seconds for timed prescriptions, explicitly skip sets, edit saved sets, and review before completing. A session cannot finish while planned sets remain unreviewed.
- Recorded video and manual entry use the same set contract. The user explicitly selects a matching counting rule when attaching a video to a catalog exercise; unknown catalog IDs are never matched through fuzzy names. Detected and reviewed reps remain distinguishable. Video and landmarks stay local.
- Independent recordings save atomically as recorded sets. They include an explicit performed time and clip duration, appear in history/Progress, and do not masquerade as a completed training day.
- Backend revisions protect set, pause, and completion updates from overwriting concurrent changes. Unique per-account operation keys protect start/record requests from duplicates. Conflicting payloads using the same key are rejected. Replaying an acknowledged set/completion returns the existing result.
- Reloading an active workout retrieves its saved record. Account-scoped drafts preserve reviewed input and pending set requests without storing video. Coach provides recovery for unconfirmed starts/recorded saves and an active-session link.
- Reports reload by ID and show readable exercise snapshots, individual completed/skipped sets, reps/load or duration. History paginates with a timestamp-plus-ID cursor, including records that share a timestamp. Reports support native sharing or clipboard feedback when available.
- Progress and Goals use backend summaries instead of deriving lifetime statistics from the latest 20 workouts. Training summaries group distinct training dates, preserve exercise variation identities, and derive best saved set results. Legacy aggregate results remain visible in history/reports; unknown historical set structure is not invented.
- Activity XP and leaderboard workout credit use a shared policy/filter: one credit per qualifying training date; individual recordings and entirely skipped sessions are excluded. The policy is version 2 and the leaderboard explains historical recalculation. Rank comparisons ignore snapshots from the older policy. Workout credit enters a competition period based on the first qualifying session for that date, avoiding duplicate credit across a UTC week boundary.
- Activity/nutrition/settings GET paths are read-only. Ordinary activity refresh no longer PUTs the timezone. Nutrition changes invalidate dependent activity/leaderboard resources after server confirmation.
- Shared hooks deduplicate in-flight reads, keep a short account-scoped cache, and invalidate affected resources after mutations. Profile, plan, settings, workout summaries and leaderboard reads reuse that mechanism. Logout clears profile/drafts/caches and redirects; delayed nutrition events are checked against their originating account.
- Home, Nutrition, today's log and food history read the same saved nutrition targets. Me exposes target editing and identifies defaults. These are user-set targets, not newly introduced medical/diet calculations.
- Profile is the primary training-preference source, with legacy Settings values used only when the corresponding Profile field is absent. Saved Coach program hashes are reused. Weight/length display converts compatible measurement units before comparison.
- Internal app navigation uses the Next.js router. The inactivity preference now controls monitoring; pausing a workout suspends it. Recorded-video analysis suspends monitoring for that flow. The alarm-volume preference selects the app audio gain; it does not override the phone's system volume.

## Measured checks and bounded claims

| Check | Evidence | Meaning |
| --- | --- | --- |
| Standalone recording save | Browser test observes one `POST /workouts/recorded`, instead of the previous create + complete pair | 2 → 1 mutation requests, a 50% reduction for this specific operation; no claim about total app load |
| Three-set workout | Browser fixture observes one creation, three set saves, two explicit pause/resume actions and completion | Results are saved at explicit actions; no per-frame or per-second rep writes |
| Activity/settings/nutrition reads | Service spies assert no initialization/preference writes on these read paths | Removes the prior activity timezone write and read-time upserts; leaderboard rank-snapshot writes are a separate existing behavior |
| Internal navigation | Browser fixture retains a document marker and reuses the loaded profile | Does not reload the document for the tested Home/Goals transition |
| History/summary limits | Regression fixture returns 150 training dates; summary pipeline contains no recent-history limit | The old 20/100-workout truncation is removed; this is not a live MongoDB throughput benchmark |
| Shared cache | Hook test checks concurrent request deduplication, stale-response rejection after invalidation, and account switching | Reduces duplicate reads while keeping confirmed mutations authoritative |

Automated evidence covers TypeScript/builds, service tests, browser workflows with mocked APIs, generated MP4 decoding, and the real local model's failure path on a blank clip. Synthetic landmarks establish counter behavior, not accuracy on actual exercise footage.

Final local checks:

| Check | Result |
| --- | --- |
| Backend suite | 325 tests passed across 42 files; affected service tests also passed after final changes |
| Frontend Node suite | 101 tests passed |
| Mobile entry/connection/Expo Go tests | 13 tests passed |
| Browser suite | 19 tests passed; three affected journeys reran successfully after the final pause/camera guard |
| Frontend and backend production builds | Passed |
| Mobile TypeScript | Passed |
| Backend lint | No errors; three pre-existing warnings remain in Coach/test fixtures |

The browser journey also checks a timed plank, paused-state handling of a delayed native countdown event, an unsaved draft surviving reload, and skipped-set preservation. A separate browser check verifies that an undecodable clip can still save manually entered reps and duration. Service and hook tests check ownership, atomic revision predicates, retry keys, cache invalidation, account isolation, and clearing account drafts on logout.

## Local verification commands

From the repository root:

```powershell
npm run build
npm --prefix backend run build
npm --prefix backend test
node --test frontend/tests/*.test.mjs
node --test mobile/connection.test.mjs mobile/entry.test.mjs mobile/expo-launch.test.mjs
node node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json
```

Browser tests use `frontend/playwright.tracking.config.mjs` and Chrome. When a production frontend is already running on port 3221, set `PQ_TRACKING_EXTERNAL_SERVER=1`; otherwise the configuration starts its own test server. Browser APIs are mocked in these workflows, and real model/runtime files are served locally.

## Rollout and remaining external checks

1. Build/restart the backend as well as the frontend. Existing clients still have their legacy create/pause/complete routes; the updated frontend requires the new detail/set/recorded/summary routes.
2. Confirm the compound unique index on `(userId, requestKey)` and the history/summary indexes in the intended database before enabling the new clients. Startup awaits model initialization. If automatic index creation is disabled in deployment, create the declared indexes through the normal database migration process first. The unique index is partial and does not require inventing keys for old records.
3. Read back a staging account's saved sets and report from MongoDB. Exercise true duplicate-key races and concurrent devices against the real database. Service doubles validate requested operations but do not prove a deployed database has the indexes or runs the pipelines correctly.
4. Use MongoDB explain plans and production-like record volumes to measure summary and leaderboard query costs. Leaderboard calculation still spans relevant users/nutrition histories; a durable daily credit collection or cached summary is a possible follow-up if measurements justify it. No infrastructure was added based on guessed traffic statistics.
5. Test Android and iOS Expo Go with real clips, codecs, screen locking/backgrounding, saved-session recovery, actual device battery/heat, and paused/disabled safety monitoring. New native development builds are not required for recorded-video counting, but native live counting remains a separate capability.
6. Meal/water history uses calendar-date records. Historical rows without timezone metadata cannot be retroactively converted into precise UTC instants. New workout dates are frozen when saved; leaderboard competition boundaries are explicitly UTC.
7. Old abandoned sessions and unknown provider IDs are retained honestly. No automatic exercise-identity backfill or deletion of legacy data was performed. The broader password-recovery/security items in `REMAINING_WORK.md` remain separate work.

## Summary

Manual and video input now join at a reviewed set, sets belong to a recoverable workout, and reports/progress/goals/rewards use persisted records with explicit identities and counting rules. The implementation also removes avoidable reads/writes and one recording-save request. The next evidence-driven decision is whether measured database query costs warrant daily aggregates; physical-device accuracy and performance still require device testing.
