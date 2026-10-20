# Active Routine Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. User approved the brief and explicitly requested proceeding; no additional approval gate or commits.

**Goal:** Show the whole routine, record manual sets, support ordered progression/skip/revisit and recovery, and honestly report partial completion.

**Architecture:** Reuse existing authenticated workout snapshots, revision-checked set PATCH, active/detail GET and completion endpoints. A RoutineSession component composes the existing LiveSession safety/timer/camera implementation. MongoDB is authoritative for confirmed sets; account/API/workout-scoped localStorage holds only unsaved numeric drafts and selected exercise. No offline save queue.

**Tech Stack:** Existing Next.js/React, native HTML controls, NestJS contracts; no dependencies.

**Spec:** Approved brief and six additions in this chat, October 20, 2026.

## Constraints and decisions

- API load unit is kg; label inputs Weight (kg). Optional load means no added weight. Bodyweight/timed sets offer one-tap confirmation of prescribed work without typing, explicitly user-confirmed rather than measured.
- Saved sets are editable while active, using the same deterministic exerciseId:setIndex and expectedRevision; completed sessions are read-only.
- New sessions include immutable routine snapshots and a request key. Reopen fetches active server state and offers Resume; it never automatically reactivates camera/safety monitoring in the background.
- Local drafts persist across app close on the same device/account/API. Storage failure is visible; never claim an unsaved set is on the server. When a device checkpoint exists, closed time is excluded: Resume pauses the recovered workout on the server if necessary, then requires an explicit Resume action. Without a checkpoint, elapsed time includes the unknown gap; the recovery banner explicitly discloses this limitation.
- Early end confirms and saves remaining slots as skipped because the API requires every slot reviewed. Report completed versus skipped/unrecorded work; no fabricated reps/load/form scores.
- Preserve inactivity/alarm priority and callbacks; progression remains usable without camera access. Numeric keyboards, >=44px targets.
- No native migration, live form analysis, automatic rep measurement or new database/schema/state library.

## Tasks

- [x] Add contract/helper regressions for snapshots, kg, timed/bodyweight defaults, progress and malformed/account-scoped drafts. Run red, implement minimal helpers/API types.
- [x] Add full-routine composition, confirmed set saves/corrections, skip/revisit, early end, and selected-exercise updates without remounting safety/timer. Failed saves retain drafts; revision conflicts refresh server state and require user retry.
- [x] Add active-workout recovery and draft restoration. Persist confirmed snapshots server-side and local input drafts independently. Legacy active sessions without snapshots remain finishable without invented set data.
- [x] Browser regressions: full routine; bodyweight no typing; numeric/label/target geometry; weighted/timed sets; saved correction; skip/revisit; failed save/retry; duplicate saves; conflict refresh; early end/cancel/failure; pause during a set; camera denied; reopen with confirmed and unsaved work; user/API isolation. Re-run existing safety, report and Coach suites, Node suite and build.
- [x] Update relevant rules/checklist and next progress report with actual evidence. Independent final review, fix material findings; no commit/push.

## Review focus

Safety events must use the current exercise (avoid stale event closures). Only server-confirmed sets advance. Restoring drafts must validate bounds and not leak across users. Recovered sessions exclude closed time when a device checkpoint exists; disclose the fallback when unavailable. Timed prescriptions use durationSeconds, not fake reps. Set corrections replace the same slot; skip must not overwrite completed work.

## Verification evidence

Frontend Node: 116/116. Dedicated routine browser: 9/9. Existing Coach browser: 13/13. Existing backend workout contracts: 31/31. Production build passed. Independent review findings addressed: completion-response recovery, pause synchronization, and explicit unknown-checkpoint disclosure. Screenshots inspected at phone width; geometry checked at 320/390/768/1440. Live database and physical hardware not checked.
