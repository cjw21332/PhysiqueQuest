# Dark theme pass for Scan and safety screens

Date: October 19, 2026

## Scope

Applied the supplied dark visual references to the Scan nutrition overview, review estimate, and daily log, plus the Coach inactivity countdown and emergency alarm. Quests and Me remain on their existing palette until their references are provided.

## UI changes

- Added a route-scoped `scan-dark-theme` wrapper with the established dark tokens; this also keeps Scan profile-loading/error surfaces dark without changing other legacy routes.
- Added scoped dark surfaces, green actions, dark calorie-ring tracks, and readable warning/item states for the existing Scan screens.
- Matched the countdown and alarm surfaces to charcoal, coral, and deep red while retaining the existing safety status colors and controls.
- Kept component text, typography, sizing, layout, API-backed data, navigation, and all screen flows unchanged.
- Screenshot review caught light result rows with low-contrast labels in Review Estimate; changed those rows to transparent on the dark page and added a browser assertion.

## Documentation

Updated `.agents/rules/DESIGN.md` to record the staged Scan/safety palette, and added this dated evidence summary to `docs/checklist.md`. No live-integration or physical-device checklist item was marked complete.

## Verification

- Frontend Node tests: 105/105 passed.
- Frontend production build: passed.
- Mocked-API Scan browser test: passed for the nutrition overview, review estimate, and daily log; includes palette and surface contrast assertions.
- Coach browser suite: 13/13 passed, including computed-style checks for cooldown, ring, alarm, stop control, and alert log colors, plus existing Coach flow regressions.
- Scoped `git diff --check`: passed.

This verifies the web presentation and mocked browser states. Expo Go uses the same web UI, but no physical-device render or emergency sensor/audio/contact-delivery flow was exercised. Live nutrition API/provider and persisted-data behavior were not part of this visual pass.
