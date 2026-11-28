# UI/UX audit, 1.6.8

Mechanical checklist built from greps on the 1.6.7 tree. "Fixed" means changed and tested in this pass; "Open" means still to do. Audit yardstick: `DESIGN.md`, especially "Network, session and permission states", "Inputs / Fields" and "Motion and accessibility".

## Baseline (before this pass)

- `tsc --noEmit`: 0 errors
- `node --test tests/*.test.mjs tests/*.test.ts`: 232 pass, 2 fail. Both fail before this pass: `personal-exercises.test.ts` and `weight-update.test.ts` import extensionless modules the runner can't resolve.
- `npm run test:ui-guard`: 22 pass
- `oxlint`: one pre-existing warning (`RoutineSession.tsx` unused `seconds`)
- Browser specs: run one at a time, per the browser-test-baseline memory

## Session, network and permission states (global)

- [x] **False "Sign in to sync" after a server restart.** `SessionBoundary` treated every null session refresh as expired. A null can also mean a newer session change superseded the request. Now it reads the session's own `sessionExpired` flag, which only a server 401 sets. (`components/SessionBoundary.tsx`)
- [x] Covered by `rotating-session.test.mjs` (13 pass).
- [x] Slow connection: already matches. `SLOW_REQUEST_MS = 6000` in `api.ts` (chat and photo scans excluded), and the toast says "Keep the app open; nothing you entered is lost."
- [x] Permission denied and session expired wording: already shared in `lib/apiErrors.mjs` (`friendlyRequestMessage`): 401 "Your session expired. Sign in again.", 403 "You don’t have permission to do that." Specific server messages are kept.
- [x] Camera denied: handled once in `hooks/useCameraStream.ts` (`NotAllowedError`/`SecurityError` → "Camera access is blocked. Allow the camera in your browser or phone settings, then tap Enable camera again."). `CameraCheck` reviews an uploaded video and never opens the camera.

## Forms and validation

- [x] **Auth login and register:** each field has its own message, `aria-invalid` and `aria-describedby`; the first invalid field gets focus; typing clears only its own message; native bubbles are replaced by these messages (`noValidate`). Covered by `tests/browser/auth-validation.spec.mjs` (3 pass, palette check included) and the register regression spec (pass).
- [x] **Forgot password:** email, code and new-password steps link their message to the failing field (`aria-invalid`, `aria-describedby`), check the email format, and show the registration password checker. Covered by the forgot-password test in `auth-validation.spec.mjs` (4 pass).
- [x] **Password length decided: 8–15 characters everywhere.** That is the policy in the client checker and in `backend/src/auth/validators/password.validator.ts`, so the forgot-password `maxLength={15}` already matches. No change.
- [x] `AppFeedbackForm`: the message box now has an accessible name; the rating group or the message box is marked invalid and linked to the layout's error (`#me-edit-error`).
- [x] `AddFood`: quantity and grams-per-serving inputs are marked invalid and linked to the amount message.
- [x] `EditMeal` already linked its field (1 `aria-invalid`).
- [x] Me edit forms: inputs are pickers and number fields validated by the server; the shared layout shows the error, a "Saving..." busy label and an offline read-only note. No change.

## Search and empty results

- [x] `ExerciseLibrary`: "No exercises match “query”…" with "Clear search and filters" when a search is typed; the filters-only wording is unchanged (3 specs rely on it).
- [x] `ProgramBuilder` picker: "No exercises match “query”. Try another name or muscle, or add it as a custom exercise above."
- [x] `WorkoutEditor` already had "No available exercises found…".
- [x] Shared empty-state styling exists: `cq-empty`, `cq-inline-error`, `lb-state`, `profile-load-state`. Restyle, don't rewrite markup.

## Loading and error

- [x] Every data screen was checked for loading, an error state and Retry. All had them except Training progress, which showed its error with no way to retry; it now has "Try again". Food history (account start date only) and the workout session ("History is unavailable. Enter your own values.") degrade on purpose.

## Dialogs and popups (23 files, 30 with Escape handling)

- [x] Every `<dialog>` has an accessible name (`aria-labelledby` or `aria-label`).
- [x] Close glyphs: `×` replaced with the shared close icon in `WorkoutEditor`, `WorkoutKeypad`, `ExerciseLibrary` (picker), `ForgotPasswordFlow`, the launch toast and the login toast.

## Typography and headings

- [x] Sub-pages use `h2`: `DietaryPlan` and `SupplementGuide` changed from `h1`.
- [x] Test-selected headings are unchanged (`My Dietary Plan` still matched by role and name).

## Buttons and destructive actions

- [x] Cancel-workout dialog: "Discard workout" regains its danger fill. Added a higher-specificity rule in `app/globals.css`. Checked on the phone with 1.6.8 (red fill shown; test workout discarded).
- [x] Me edits: the save button shows "Saving..." while busy, and a successful save shows a confirmation toast (`role="status"`), e.g. "Thanks! Your feedback was sent to the team." and "Profile photo saved".

## Motion and accessibility

- [x] Reduced motion: a universal rule in `app/globals.css` cuts every animation and transition when the device asks, so newer animations are covered too.
- [x] Focus outlines only on keyboard navigation: `components/InputModality.tsx` (mounted in `app/layout.tsx`) sets `html[data-keyboard]` on Tab/arrow keys and clears it on pointer; `app/globals.css` scopes outlines to it.

## Not changed on purpose

- `OfflineLeaderboard` back span: the header sits in an `inert`, `aria-hidden` preview. The real "Back to quests" button is present.

## Next pass (module order from the advisor)

1. Auth: field-level validation, session expiry, forgot-password states.
2. Home, Coach, Scan, Quests, Me: data-hook error and empty states, no-results, 403 and camera-denied messages.
3. Responsive check at 360 px and tablet width.

## Phone pass (1.6.8, 2026-11-28)

- Exercise library search with no match: "No exercises match “query”. Check the spelling or clear the search and filters." and **Clear search and filters** restores all 1,500 exercises.
- Cancel-workout dialog: red **Discard workout** fill.
- Server cold start: the app showed "Connecting to PhysiqueQuest", not "Sign in to sync" (the session-expiry fix).
- Login, register and forgot password were checked in the browser with the session mocked (`auth-validation.spec.mjs`, 4 pass), not on the phone: that needs signing out.

## Browser specs run

- `auth-validation.spec.mjs`: 4 pass (new).
- `calibration-redesign.spec.mjs`: 1 pass (register flow regression).
- `exercise-library.spec.mjs`: 7 pass, 9 fail. The API-failure test fails without this pass's change too (checked by stashing it); the others fail on selectors unrelated to it ("Equipment type" matching 3 elements, admin catalog timeouts).
