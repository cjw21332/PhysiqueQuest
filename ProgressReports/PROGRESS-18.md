# Progress Report 18 — Persisted Training-Day Preferences

**Scope:** Save training days from onboarding and Me settings, then schedule Coach workouts on those exact weekdays  
**Status:** Implemented; frontend/backend builds and automated suites passed. A live authenticated save against the deployed database still requires environment-level verification.

## Summary

Training days now use canonical weekday names (`Monday` through `Sunday`) across onboarding and the Me training-preference editor. The existing authenticated profile update endpoint stores the selection in the profile record, and Coach builds workout sessions for those exact days rather than inferring weekdays from the number of selected days.

## Behavior updated

- Onboarding saves canonical weekday names instead of ambiguous initials.
- Me → Training preference loads older weekday values, allows the user to edit them, and sends canonical names through the existing profile API.
- A failed save leaves the editor open and displays the API error; an empty selection is rejected with an accessible validation message.
- The Me profile summary refreshes immediately after a successful save and lists the selected weekdays.
- Coach highlights the exact selected weekdays, starts on the current day, and uses full weekday names for accessible controls.
- Coach continues to read legacy weekday IDs and initials. A historical single `T` or `S` is inherently ambiguous and resolves to Tuesday or Saturday; repeated initials map to distinct weekdays where possible.

## Files and system areas updated

- Shared weekday normalization and labels: [trainingDays.ts](../frontend/lib/trainingDays.ts).
- Onboarding persistence: [CalibrationFlow.tsx](../frontend/sections/Auth/CalibrationFlow.tsx).
- Me preference save feedback and current profile display: [TrainingPreferenceEdit.tsx](../frontend/sections/Me%20Section/TrainingPreferenceEdit.tsx) and [MeSection.tsx](../frontend/sections/Me%20Section/MeSection.tsx).
- Weekday-specific Coach schedule generation and display: [coach.service.ts](../backend/src/coach/coach.service.ts) and [CoachPlan.tsx](../frontend/sections/Coach/CoachPlan.tsx).
- Regression coverage: [coach-plan.spec.ts](../backend/test/coach-plan.spec.ts), [profile-training-days.spec.ts](../backend/test/profile-training-days.spec.ts), and [coach-plan.test.mjs](../frontend/tests/coach-plan.test.mjs).

## Verification

| Check | Result |
|---|---|
| Backend test suite (`npm test`, run from `backend/`) | Passed: 273/273 tests. |
| Frontend Node test suite (`node --test tests/*.test.mjs`, run from `frontend/`) | Passed: 57/57 tests. |
| Backend lint on modified source and tests | Passed. |
| Backend production build | Passed. |
| Frontend production build and TypeScript check | Passed. |
| Patch whitespace check (`git diff --check`) | Passed. |

The backend profile-service test verifies that the selected weekday array is sent to MongoDB in the update patch. It uses a mocked model; it does not replace a live authenticated save/read test against the deployed database.
