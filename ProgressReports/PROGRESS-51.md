# Progress 51 — Completed workout recovery banner

October 20, 2026

User reported Workout in progress after ending a session. Found two recovery weaknesses: the frontend trusted a one-time active lookup and the backend filtered active sessions before sorting, allowing older abandoned sessions to reappear after the newest was completed.

The active endpoint now retrieves the latest full session (excluding individually recorded sets) and returns it only if active. Older unfinished records remain unchanged in history; this endpoint represents current-session recovery. Active/detail responses send Cache-Control: no-store and frontend requests bypass caches.

Coach revalidates the candidate with current detail status before displaying it. It refreshes when the plan returns and on focus/pageshow/visibility restoration. Request generations discard late stale results, completed records never qualify, and failures expose retry while blocking duplicate starts.

Validation: 12 routine browser tests pass, including ending → report Back → reload even when the active response is stale, and completion on another screen followed by focus. Backend workout checks: 34 passed, including latest-completed/null/current-active recovery and cache headers. Frontend Node: 116 passed. Backend lint/build and frontend production build passed. Evidence: artifacts/completed-workout-recovery/.

No live database records were modified/deleted, no commit/push. Backend restart/redeployment and frontend reload/redeployment are needed for an already-running installation. Physical phone and deployed service behavior were not checked.

Additional Coach/cache navigation regressions: 10 passed. Evidence: artifacts/completed-workout-navigation/.
