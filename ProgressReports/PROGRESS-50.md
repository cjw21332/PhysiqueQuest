# Progress 50 — Abandoned workout can end

October 20, 2026

Reported failure: an unfinished workout displayed 11301:31 (678091 seconds) and could not end because completion request validation capped durationSeconds at 86400. The service never uses that client counter; it derives duration from persisted start/end/pause timestamps.

Made the legacy completion counter optional/nonnegative integer without the irrelevant 24-hour cap; retained individual set duration validation. New RoutineSession completion requests omit the unused counter. Saved sets, completion revision checks and idempotency behavior remain intact. No database correction or deletion was performed; unknown historical active time is not reconstructed.

Verified failing DTO regressions before the fix, then passing omission/678091/invalid-counter/per-set-cap checks. Backend workout suites: 28 passed. Routine browser suite: 10 passed, including recovering/ending a session aged 678091 seconds and confirming no duration counter is submitted. Frontend Node: 116 passed. Backend lint/build, frontend build and diff checks passed. Browser evidence: artifacts/stale-workout-fix/.

To apply to a running installation, restart/redeploy the backend and reload/redeploy the frontend, then resume the existing workout and end it. Older frontend versions also benefit once the backend fix is deployed. No live database/account or physical phone was tested or modified. No commit/push.
