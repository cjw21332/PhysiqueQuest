# Remove section-switch reloads and loading flashes — October 19, 2026

## Cause and change

The shared navigation helper used `window.location.assign` for each tab click, reloading the app and discarding its in-memory cache. Resource hooks also initialized empty and restored cached data after paint, briefly showing a profile loader before the destination module loader.

- BottomNav now uses the Next.js client router, prefetches Home/Coach/Scan/Quests/Me and skips a push to the already-active tab.
- Home shortcuts, Coach's return-home action and goals/progress back/account actions use client navigation. Login/logout and session-expiry boundaries retain hard redirects.
- `useAppResource` subscribes/hydrates in a layout effect so valid cached responses are applied before paint. Existing account/server scoping, expiry, refresh, invalidation and stale-response checks remain intact.
- Removed large profile, Coach-plan, nutrition and quest loading messages. Genuine cold loads show non-animated, accessible placeholders; actual errors and retry actions remain.
- Disabled Next.js devIndicators. Browser trace/screenshot showed its bottom-right badge covering the Me button and intercepting clicks. Local Next.js documentation confirms errors remain surfaced with the indicator disabled.
- Updated backend/design/procedure guidance and the checklist to retain this navigation behavior.

## Verification

- Added a browser regression before implementation; the original code failed because its document marker disappeared on tab navigation.
- Final cache/navigation/Coach browser suite: 8/8 passed. New regression covers all 25 ordered pairs of the five main tabs, same-tab clicks, preserved document identity, no old loading-text flashes and no page errors. The existing suite still covers cache restoration, failures, logout/account isolation and confirmed mutation behavior.
- Existing journey browser suite: 6/6 passed across Home, goals, progress, notifications and Scan flows.
- Frontend production build and TypeScript checks passed.
- Full frontend Node suite: 113/114. The existing meal-edit test expects “No logged yet” where the existing UI renders “Not logged yet”; this unrelated assertion was not changed. Updated the old navigation assertion to distinguish hard auth redirects from client tab transitions, the Coach loading assertion to check its accessible busy state, and the hook test harness for the layout effect.
- Independent read-only review found no important auth, cache isolation or route-target regressions.
- `git diff --check` passed. No dependencies, commits, pushes or extra runtime servers.

## Limits

No physical-device/WebView back-button check or mobile latency benchmark was performed. First use with no valid saved data still requires a server response; it now has a quiet placeholder. Backend APIs and storage were not changed or retested for this frontend-only update.
