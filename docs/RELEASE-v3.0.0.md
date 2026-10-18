# PhysiqueQuest v3.0.0

Branch: `PhysiqueQuest-v3.0.0`. Prepared October 18, 2026 from the v2.7.4 working tree. This document describes the current implementation; it does not announce a deployed or published release.

## Shared backend and performance

Exercise browsing, stateless Coach previews, saved programs and account/workout features now share one NestJS API. The separate library listener and its startup scripts were removed. Frontend and Android clients use the main API connection configuration, including existing LAN/runtime address handling. Matching provider requests can share in-flight deduplication and pacing in one process. Render's Blueprint now declares web and API services only. See [combined API scope and availability tradeoff](COMBINED_API.md).

Client resources reuse API reads, reject stale responses and refresh related screens after writes. Saved Coach program versions avoid repeated external generation when training preferences are unchanged. Backend memory/billing savings have not been measured as a percentage.

## Workouts, exercise guides and counting

- Explicit Start set / Done set prompts, pause / continue, session recovery, and remaining-set counts.
- Results isolated by account, scheduled date, week and program, with reviewed recordings attachable to a planned set or saved independently.
- Connected workout history, activity, goals, quests and leaderboard updates.
- Three library sources: ExerciseDB demonstrations, 50 PhysiqueQuest manual guides and 609 attributed RepDB guides with still illustrations. Catalogs are not interchangeable with counting support.
- Configurable local counting engine: 27 selectable presets across 12 movement families, including push-ups, hinges, glute bridges and stationary lunges. New families support estimated 3D landmarks where available.
- Automatic identification remains limited to five generic families. Counts and labels are reviewed before saving; the rules remain experimental. No trained production classifier has been activated.

Details: [daily sessions](COACH_DAY_PROGRESS.md), [counter engine](CONFIGURABLE_COUNTER.md), [exercise expansion](EXERCISE_EXPANSION.md), [RepDB scope](REPDB_LIBRARY.md).

## Security, administration and Android behavior

Me-page password changes now use authenticated request/verify/confirm routes. The server selects the registered account email, rejects alternate recipients, and binds authorization to the owning user, purpose, email and session version. Public recovery grants cannot authorize this flow. Password writes and grant consumption are transactional; successful changes revoke older sessions. Signed-out recovery retains a separate request-bound flow. See [password-change fix](PASSWORD_CHANGE_FIX.md).

Administrator exercise editing/publication/deletion and API-backed analytics were completed. Ordinary users remain blocked from administrator routes. Sharing supports the available browser/native bridge. Foreground safety startup/stop behavior prevents late sensor initialization from restarting a stopped monitor; background/locked monitoring is paused with an explicit-resume notice.

## Research and deployment readiness

Offline classifier training and benchmark evaluation tools were added. The Qualcomm research workflow audited 74 videos and successfully extracted one real video, but has zero manually verified scored segments. Its research-only data is excluded from app distribution and classifier training. Deployment-compatible motion data and real-device accuracy evidence remain necessary. See [research status](QEVD_RESEARCH.md).

Render staging configuration, Android release URL guards and EAS profiles are prepared. No live Render service, signed Android distribution or physical-device validation is claimed. Remaining Expo/tooling audit findings are described in the [dated dependency audit](DEPENDENCY_AUDIT_2026-10-18.md).

## Recorded verification

Latest application verification on October 18, 2026: **370 backend tests**, **202 frontend/mobile Node checks**, **58 browser checks**, and **two isolated MongoDB transaction tests** passed. Frontend/backend production builds and lint passed. Earlier mobile TypeScript and Hermes export checks passed; these are not a signed native installation or physical-camera accuracy evaluation.

The browser/provider scenarios use fixtures; database transaction checks use synthetic accounts, mocked email and a separate random test database. Documentation updates for this branch do not require re-running those application suites. See [README](../README.md) for current startup commands and [deployment gates](RENDER_DEPLOYMENT.md) for remaining operational checks.

## Architecture documents

The updated [ERD](ERD.md), [data dictionary](DATA_DICTIONARY.md), [Android network layout](NETWORK_LAYOUT.md) and [LAN layout](NETWORK_LAYOUT_LAN.md) describe the current schema and shared API. Editable Mermaid/draw.io and rendered diagrams are included. Earlier release notes remain historical references.
