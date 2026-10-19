# Restore original layouts across the migrated dark screens

Date: October 19, 2026

## Scope and behavior

Applied the Coach restoration approach to every previously themed section requested by the user: launch, login/register, four-step calibration, Home, goals, progress and notifications. The dark palette and shared scrollbar remain in place. The separately requested launch top/bottom spacing is retained.

Restored the original CalibrationFlow, HomeDashboard, Progress and Notifications presentation. Calibration again has Back and Clear controls and the original sections/scroll structure; saved selections survive Back navigation and placement validation remains enforced. Progress again places Add measurement in the header and history alongside its trend. Goals, Progress and Notifications show their original Home back controls. Password visibility, registration/profile saving, recovery Close, measurement save/delete and notification read actions retain their existing API-backed flow. Launch preserves the corrected OS-readiness evaluation.

Removed the standalone onboarding/journey redesign stylesheets and their imports. Their approved colors now live as scoped palette rules in globals.css, with no replacement layout/type overrides. Default/legacy theme tokens and the reusable scrollbar stylesheet remain separate shared imports. Coach and its safety implementation were not changed by this follow-up.

## Documentation

Updated DESIGN.md to October 19, 2026, documented current dark tokens versus staged legacy pages, restored control placement and theme-only styling rules, and corrected obsolete Coach fixture/playback descriptions. GENERAL.md now protects functionality and layout during theme work. PROCEDURES.md records the current style ownership, restored flows and verification requirements. Reviewed docs/checklist.md and added follow-up evidence without changing live end-to-end completion marks.

## Verification

- Onboarding/login browser tests pass (2 tests): registration/profile payload, every calibration Back path, Clear, validation, password visibility, recovery dismissal and viewport checks.
- Home/goals/progress/notifications browser tests pass (2 tests): Home return controls, real-response rendering, measurement save/delete/history and individual/mark-all read callbacks.
- Coach/library regression browser tests pass (12 tests).
- Original-versus-dark layout comparisons preserve dimensions, typography and positioning. Browser viewport coverage includes 320, 390, 768 and 1440 pixels; screenshots reviewed for auth, calibration, Home, goals, Progress and Notifications.
- Frontend Node suite and production build pass; diff whitespace check passes.

Browser API responses and camera inputs are mocked. This does not establish live MongoDB/provider round trips, physical-device keyboard/camera/audio behavior or deployment verification. No backend or native mobile code was changed for this task.
