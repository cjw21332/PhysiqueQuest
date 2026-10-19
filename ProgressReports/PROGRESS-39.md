# System-wide dark palette completion — October 19, 2026

## Scope

- Promoted the supplied DESIGN.md palette to the single authoritative root set in frontend/app/theme.css. Removed legacy light tokens, section color copies and the light route fallback. Updated browser theme metadata and scrollbar colors.
- Aligned existing dark presentation rules in globals.css with shared tokens. Finished shared dialogs, recovery feedback, logout, camera controls, navigation, photo chooser, required labels and analytics sample captions. Maintained contrast in alarm hold progress and selected/inactive streak indicators.
- Aligned mobile/App.tsx loading, reconnection/error banners and camera overlays, plus mobile/app.json backgrounds and light system indicators. Removed the obsolete per-route light indicator selection. No timers, sensor callbacks, API/persistence logic or navigation actions changed.
- Preserved existing dimensions, type, responsive layouts and unrelated working-tree edits. Updated DESIGN.md, GENERAL.md, PROCEDURES.md and checklist guidance for one dark palette across the system. No dependencies, commits or pushes.

## Verification

- Frontend production build: passed.
- Combined browser theme suite: 14/14 passed using mocked APIs and a light OS preference. Rendered palette assertions inspect visible text, backgrounds, icon colors and borders; existing flows cover registration/calibration, measurement save/delete, notification reads, five profile editors, leaderboard periods, exercise library/detail controls, camera/upload, workout pause/resume/completion, nutrition/review/log/add/edit/history, admin controls and export. Responsive checks cover narrow/short phone, tablet and desktop widths.
- Added overlay/public/error checks: password recovery request/verify/new-password/success, logout cancellation, photo chooser cancellation, public library empty state and profile error/retry presentation. These 2 tests passed again with animations disabled for stable palette inspection/screenshots.
- Mobile TypeScript check and mobile Node tests: passed.
- Full frontend Node suite: 104/105 passed. Existing unrelated meal-edit.test.mjs expects “No logged yet”, while Today’s Log currently renders “Not logged yet”. Left this unrelated copy/test mismatch unchanged.
- Inspected dashboard and logout screenshots. git diff --check passed.

## Limits

No backend changes or backend tests. No live database/provider/deployment run, native bundle export or physical Android/iOS check. Native configuration changes require the normal app rebuild to reach an installed native binary. Browser fixtures and type checks do not prove hardware behavior. Checklist completion totals remain unchanged.
