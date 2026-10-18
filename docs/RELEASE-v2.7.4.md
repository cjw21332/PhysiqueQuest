# PhysiqueQuest v2.7.4

Release date: October 17, 2026. Based on PhysiqueQuest-v2.7.3.

## Workout sessions and daily progress

- Introduce a configurable movement registry, estimated 3D measurement support and 27 counting presets. Prepare offline phase-classifier training/evaluation tools without activating an unvalidated model. Add 609 attributed RepDB library guides as a lazy-loaded, in-app source. See [engine details](CONFIGURABLE_COUNTER.md) and [RepDB scope](REPDB_LIBRARY.md).

- Expand local automatic counting to 20 presets, adding overhead presses, lateral raises, knee/wall push-ups, rows, overhead triceps extensions and equipment variations; video scanning can suggest press/raise families. See [counter rules and validation limits](REP_COUNTER_EXPANSION.md).

- Expand the built-in catalog from 20 to 50 manual exercises, with a browsable PhysiqueQuest source and equipment-aware candidates for new Coach plans. See [exercise additions and validation](EXERCISE_EXPANSION.md).

- Add explicit Start set and Done set actions, with a ready prompt before each next set or exercise.
- Add Pause session and Continue session controls that remain accessible while scrolling. Pausing preserves the current entry and disables logging until the session continues.
- Restore active sessions, entered reps and load, pending saves, and reviewed sets after reload. Failed saves support retry without duplicate set credit.
- Keep completed and skipped sets tied to the correct scheduled calendar date, program, and account. Show completed, skipped, and remaining sets for each exercise and workout.
- Connect workout completion, history, goals, activity, and leaderboard updates through shared API resources and explicit refresh notifications.

## Exercise library and video logging

- Make the exercise library available to registered users without sending them to admin-only exercise management.
- Expand local repetition-counting support, including push-ups. Uploaded videos can suggest supported exercise families and count full movement cycles locally; users review the result before saving.
- Attach reviewed video results to a selected planned set, or save them as standalone recordings with exercise and rep labels.
- Add an explicit exercise match and styled Apply to set action for eligible recordings. Applying a recording fills one planned set; zero-rep recordings do not complete a planned set.

## Performance and startup

- Bind Me-page password changes to the signed-in account's registered email. Dedicated authenticated request/verify/confirm routes reject alternate destinations and cross-account or public-recovery grants; successful changes revoke prior sessions. See [password-change fix](PASSWORD_CHANGE_FIX.md).

- Consolidate exercise browsing, stateless Coach previews and saved programs into the main API. Remove the second NestJS listener and library Render service; all clients now use `NEXT_PUBLIC_API_URL`/the Expo runtime API address. Public guides remain public and personal/admin routes remain guarded. See [shared API architecture](COMBINED_API.md).
- Reuse shared API resources, deduplicate reads, and invalidate affected data after mutations.
- Improve account isolation, recovery from unavailable session responses, Expo connection handling, and local pose-worker asset loading.
- Correct root start-script argument forwarding for LAN hosting.

## Documentation

- Add an isolated Qualcomm benchmark research workflow with annotation review, local pose extraction, count/recognition reporting and benchmark-training rejection. Research data stays outside app builds and Git; no trained-model release or real-video accuracy claim is included. See [research scope and results](QEVD_RESEARCH.md).

Include the updated running guide, camera-tracking guide, cohesion plan and implementation summary, day-progress guide, and remaining-work notes. Include the database ERD in Markdown/Mermaid and the editable two-page draw.io diagram with rendered SVG/PNG versions.

- [Running the project](../RUNNING.md)
- [Camera and video tracking](CAMERA_TRACKING.md)
- [Daily workout progress and session controls](COACH_DAY_PROGRESS.md)
- [Cohesion plan](COHESIVE_FUNCTIONS_PLAN.md)
- [Implemented connections](COHESIVE_FUNCTIONS_IMPLEMENTED.md)
- [Database ERD](ERD.md)
- [Data dictionary](DATA_DICTIONARY.md)
- [Network layout and explanation](NETWORK_LAYOUT.md)
- [Editable ERD](diagrams/PhysiqueQuest-ERD.drawio)
- [Remaining work](REMAINING_WORK.md)

## Validation

The subsequent security, administration, sharing, foreground-monitoring and Render preparation changes are described in the [October 18 remediation results](REMEDIATION_2026-10-18.md), including newer verification evidence and remaining release gates. They have not yet been committed or deployed.

The latest session-control changes passed the frontend production build, 112 frontend Node checks, and eight browser scenarios covering pause/reload recovery, explicit next-set starts, retries, editing, date isolation, video attachment, and applying recordings. Earlier changes passed the backend build and 348 backend tests across 45 files, plus the mobile TypeScript check. Browser layout checks include narrow screens.

These checks use automated and mocked scenarios. Physical-device counting accuracy, a live production deployment, and changes to existing live user records are outside this validation.
