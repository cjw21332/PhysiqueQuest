# Progress 45 — Active workout routine

October 20, 2026

Implemented the approved full-routine session in the current frontend. The entire ordered routine stays visible, with per-exercise status and individual set forms. Each set confirms actual reps and optional load; API field `loadKg` is kilograms and inputs say **Weight (kg)**. Prescribed bodyweight and timed work can be confirmed without typing; values are explicitly manual, not camera measurements. Saved sets can be updated while active using the same deterministic slot; after ending, this interface is read-only and has no post-completion correction action.

Users follow the routine with skip and revisit. Skipping preserves completed work. Early ending confirms the number of unfinished sets and saves remaining slots as skipped, then reports completed/skipped/unrecorded counts and recorded work. Camera-off and camera-denied sessions support the same progression. Numeric input modes and controls at least 44px support phone use.

Confirmed sets and immutable routine snapshots use existing authenticated server APIs/MongoDB. Unsaved inputs, selected exercise and a last-seen checkpoint use localStorage keyed by API base/account/workout. Closing and reopening Coach fetches the active server session and offers explicit recovery, initially paused. Same-device drafts restore independently. A valid checkpoint excludes the closed interval; without it (another device, cleared/unavailable storage), elapsed time includes the unknown gap and the recovery banner discloses that. Storage failure warns that unsaved inputs cannot survive closing. No offline queue or fabricated successful saves.

Failed saves retain inputs. Revision conflicts reload confirmed state, preserve drafts and adopt server pause state. Duplicate actions are guarded. Completion retries keep their request payload; an ambiguous completion response fetches the authoritative record and shows the completed report if the server already committed it. Inactivity monitoring stops while paused, resumes explicitly and uses the current exercise for alerts. Alarm/countdown surfaces retain priority.

Validation:

- Frontend Node suite: 116 passed; production Next.js build passed.
- Dedicated routine browser suite: 9 passed, covering bodyweight/timed/weighted sets, kg correction, skip/revisit, failed save/retry, duplicate clicks, early-end cancel/failure/retry, pause during a set, actual tab close/reopen with saved and unsaved work, denied camera, revision conflict, server pause synchronization, lost completion response, malformed and other-account drafts.
- Existing Coach browser suite: 13 passed, including plan, library, report, pose tracking and safety styling.
- Backend workout contract suites: 31 passed across four files; no backend implementation/schema changes.
- Geometry checked at 320, 390, 768 and 1440px: no horizontal overflow, numeric keyboards, 44px set actions. Phone screenshot visually inspected. Evidence: `artifacts/workout-routine/`; Coach regressions: `artifacts/workout-coach-regression/`.
- Independent read-only review identified completion replay, pause refresh and missing-checkpoint ambiguity; all addressed as described above.

No commit or push. No deployed API/database, physical Android/iOS device, real camera or emergency-provider test was performed. Existing live-integration checklist marks remain unchanged. The native-interface migration is outside this change.
