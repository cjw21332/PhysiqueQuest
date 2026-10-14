# PhysiqueQuest v2.7.3

Release date: October 15, 2026. Includes the complete v2.7.2 codebase and the Coach changes below.

- Coach and exercise-library layouts follow the supplied references, including responsive navigation and exercise detail sheets.
- Free ExerciseDB V1 supplies real exercises, instructions and animated GIF demonstrations. Specific name search and body/equipment filters replace mock Coach exercise data.
- An independent Coach catalog/preview service runs on port 4050. Library browsing remains accessible when account/profile loading fails.
- Authenticated saved programs run in the main backend on port 4000. MongoDB's `coach_programs` collection stores per-user weekly schedules and daily exercise IDs, order and prescriptions. Reloads and backend restarts reuse the program without ExerciseDB requests; training-preference changes generate a new version.
- Existing legacy weekday formats are supported. Program suggestions respect saved training days, available equipment and health preferences, and prioritize common movements.
- Camera rep-counting beta entry points and tracking deep links are hidden. Backend, shared counter and native/worker capabilities remain available in source.

Verified: 309 backend tests across 41 files, 120 frontend/mobile Node tests, 10 browser tests, frontend/backend production builds, live provider categories/search/GIF playback, account workout persistence, and saved-program restoration from MongoDB with zero provider calls. Physical-device camera accuracy and production deployment are not certified by these checks.

See [AI Coach setup](AI_COACH.md) for both backend processes, provider limits and attribution, and [the checklist](checklist.md) for evidence boundaries.
