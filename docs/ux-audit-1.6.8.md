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
- [ ] Slow connection: the design says "after 6 seconds, says nothing entered is lost". Check the `slow` path in `api.ts` against this.
- [ ] Permission denied: the design requires "You don't have permission to do that." for 403. Only `AdminExerciseLibrary` references 403. Add a shared 403 message in `api.ts`.
- [ ] Camera denied: the design says denied camera must never block manual logging. Checked: `FoodCamera` and `PoseTrackerSession` mention permission. `CameraCheck` does not.

## Forms and validation

- [x] **Auth login and register:** each field has its own message, `aria-invalid` and `aria-describedby`; the first invalid field gets focus; typing clears only its own message; native bubbles are replaced by these messages (`noValidate`). Covered by `tests/browser/auth-validation.spec.mjs` (3 pass, palette check included) and the register regression spec (pass).
- [ ] **Forgot password:** six inputs, no `aria-invalid`; errors show in shared banners. Email, OTP, new password and confirm need field-level messages.
- [x] **Password length decided: 8–15 characters everywhere.** That is the policy in the client checker and in `backend/src/auth/validators/password.validator.ts`, so the forgot-password `maxLength={15}` already matches. No change.
- [ ] Me edit forms, `AppFeedbackForm`, `ProgramBuilder`, `AddFood` and `EditMeal` still need `aria-invalid` plus a linked message.

## Search and empty results

- [ ] No-results message repeating the query, with a next step. Missing in `ExerciseLibrary`, `ProgramBuilder` and `WorkoutEditor`.
- [x] Shared empty-state styling exists: `cq-empty`, `cq-inline-error`, `lb-state`, `profile-load-state`. Restyle, don't rewrite markup.

## Loading and error

- [ ] Data hooks (`useActivity`, `useCoachPlan`, `useNotifications`, `useNutrition`, `useProgress`, `useSavedPrograms`, `useWorkoutHistory`, `useWorkoutSummary`, `useCurrentProfile`) go through `useAppResource`, which returns loading and error. Each consuming screen still needs an error state with Retry and an offline note.

## Dialogs and popups (23 files, 30 with Escape handling)

- [ ] Each `<dialog>` needs a title id, Escape handling, focus return and an icon close button. Escape is covered in 30 places; spot-check the rest.
- [x] Close glyphs: `×` replaced with the shared close icon in `WorkoutEditor`, `WorkoutKeypad`, `ExerciseLibrary` (picker), `ForgotPasswordFlow`, the launch toast and the login toast.

## Typography and headings

- [x] Sub-pages use `h2`: `DietaryPlan` and `SupplementGuide` changed from `h1`.
- [x] Test-selected headings are unchanged (`My Dietary Plan` still matched by role and name).

## Buttons and destructive actions

- [x] Cancel-workout dialog: "Discard workout" regains its danger fill. Added a higher-specificity rule in `app/globals.css`. Phone check pending.
- [ ] Busy buttons show a busy label; saves show success. Check each Me edit form.

## Motion and accessibility

- [x] Reduced-motion coverage exists: 43 `prefers-reduced-motion` blocks against 181 animation/transition rules. Spot-check new animations (BadgeCelebrations, Phiq sheet).
- [ ] Focus outlines only on keyboard navigation (`html[data-keyboard]`). Verify in the browser preview.

## Not changed on purpose

- `OfflineLeaderboard` back span: the header sits in an `inert`, `aria-hidden` preview. The real "Back to quests" button is present.

## Next pass (module order from the advisor)

1. Auth: field-level validation, session expiry, forgot-password states.
2. Home, Coach, Scan, Quests, Me: data-hook error and empty states, no-results, 403 and camera-denied messages.
3. Responsive check at 360 px and tablet width.
