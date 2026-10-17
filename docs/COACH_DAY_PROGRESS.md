# Coach weekday history and remaining sets

The Coach's selected weekday now selects a calendar date in the current week.
The saved-workout list, resume button, and planned-set progress use that date.
Completed records from another day or week no longer appear under every tab.
Suggested exercises can still repeat as part of the prescribed weekly routine;
their completion state does not carry over.

New planned sessions save `scheduledDate` alongside `dayIndex` and
`programVersion`. The API validates the calendar date and weekday together.
This also preserves the selected date when a start is retried after midnight or
in another week. Older planned sessions use their saved weekday in the local
week of `startedAt`. If that historical context is absent, the performed date
is used. No historical record is deleted or rewritten.

Standalone recordings belong to their performed date. Their reviewed results
remain in history, but do not silently complete a prescribed set. Choose
**Apply recording to planned set**, confirm the matching planned exercise, and
the server copies its reviewed result into the next unreviewed slot for that
day. Four reps count as one logged set, not four sets; a zero-rep recording is
not eligible for a rep-based set. Timed prescriptions require a saved hold
duration. Exact normalized exercise names are suggested, while unmatched names
require an explicit choice. Neither the original recording nor the prescribed
rep target is overwritten.

The server reuses an active session for the selected date and program, or creates
one with the full prescribed set plan. The main action becomes **Resume session**
so remaining sets are logged in that session. Application is idempotent and
checks ownership, performed date, available slots and revision. `sourceRecordingId`
records provenance on the imported set; `appliedRecordingIds` reserves each source
recording once per user with a partial unique multikey index. Editing or skipping
an imported slot preserves the association. This follows MongoDB's documented
[unique multikey semantics](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/).
No video is uploaded or re-analyzed during this operation.

Planned
progress must match the date, weekday, program version and exercise identity.
Daily training credit still follows the actual activity date under the existing
credit policy; selecting an earlier weekday does not backdate training credit.

`GET /api/workouts?date=YYYY-MM-DD&timezone=...` returns the authenticated user's
matching day records. It queries explicit date fields plus a bounded week range
for legacy records and does not use the 20-record recent-history cap. Compound
indexes on `(userId, scheduledDate)` and `(userId, activityDate)` support these
lookups. **View all workout history** opens the existing full history and older
record pagination explicitly. Switching weekdays closes that full-history view.
Date-specific reads share the existing account-scoped React resource cache, so
the plan and history deduplicate the same request. Set saves and session starts
invalidate these resources. The client also filters dates while requests change.

The plan shows total completed, skipped and remaining sets, plus remaining sets
for each exercise. The workout editor shows remaining sets for the selected
exercise and the whole session. Remaining means prescribed slots not yet
reviewed; skipped slots are counted separately from completed slots. Re-saving
or editing a slot does not count it twice. Unsupported or stale result slots do
not reduce the remaining count. A failed history read shows progress unavailable
instead of presenting an incorrect zero-completion total.


## Session and set controls

- Pause session saves the pause through the workout API, stops the session timer and camera monitoring, and disables set entry. Continue session resumes the same set. Pause state survives reload; entered reps and load use the account-scoped local draft.
- Each new set waits for Start set. Done set saves the result, updates remaining sets, and prompts the user to start the next set or exercise. Sets never start automatically.
- Failed saves retain the exact pending result for retry. Editing a saved set uses Save changes without adding another set. Skipping remains available between sets.
- Session controls stay visible while scrolling. Recorded workouts have a matching-exercise selector and an Apply to set action with disabled, saving, error, and applied states.
