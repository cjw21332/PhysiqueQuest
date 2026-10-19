# Coach layout and navigation restoration

Date: October 19, 2026

Restored the Coach plan, library, camera/upload and workout report presentation to the repository's pre-theme implementation. Preserved existing view callbacks and live data behavior; retained the emergency-alarm changes in LiveSession. Coach now uses its own `coach-dark-theme` wrapper, so Home's reference redesign no longer changes Coach widths, typography, navigation or modal layout. Color overrides live in `frontend/app/globals.css`; the separate Coach redesign stylesheet was removed.

Library, Camera check and Report back buttons appear before their titles and return to the Coach plan. The five-tab navigation remains on plan/library and is absent during camera/session/report. Exercise detail dismissal, search/filter/playback, upload selection, readiness, workout start, pause/resume and completion retain their established behavior.

Reviewed `.agents/rules/DESIGN.md`, `GENERAL.md`, `PROCEDURES.md` and `docs/checklist.md`. Added focused documentation clarifications for theme-only work and the current API-backed library; historical sample-library descriptions must not be used to undo the live integration.

Verification: Coach/library browser suite passes (12 tests); assertions include back placement/callbacks, dark surfaces, no horizontal overflow at 320/390/768/1440 widths, and original-versus-themed geometry comparisons. Frontend Node suite and production build pass. Screenshots reviewed for the plan, exercise sheet and report. Mocked API/camera browser checks do not prove live provider/database behavior or physical-device operation. No backend or mobile implementation was changed by this task.
