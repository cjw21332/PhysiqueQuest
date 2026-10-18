# Exercise catalog expansion — October 18, 2026

The built-in PhysiqueQuest catalog now contains **50 exercises**, up from 20. The public library has two explicit sources: **ExerciseDB demos** and **PhysiqueQuest exercises**. Search, muscle/equipment filters, pagination and written detail guides work for the added source. It is available without database seeding or an ExerciseDB request.

## Thirty added exercises

| Equipment | New entries |
|---|---|
| Bodyweight | Wall push-up, knee push-up, close-grip push-up, bodyweight squat, reverse lunge, lateral lunge, wall sit, side plank, reverse crunch, standing knee raise |
| Dumbbells | Hammer curl, concentration curl, single-arm row, reverse fly, front squat, step-up, triceps kickback |
| Barbell | Bench press, bent-over row, Romanian deadlift, biceps curl |
| Kettlebell | Deadlift, goblet squat, row |
| Cable | Lat pulldown, seated row, triceps pushdown |
| Machine | Leg press, seated leg curl |
| Resistance bands | Biceps curl |

The original push-up and the previous 19 entries remain available. Names/equipment categories were cross-checked with the [NASM exercise library](https://www.nasm.org/resource-center/exercise-library) and push-up variations with [NASM's push-up guide](https://www.nasm.org/resource-center/exercise-library/push-up). Instructions are concise project-authored guides. These references do not imply endorsement, clinical review or individual suitability.

## Connections and resource use

- Stable `pq-` identifiers resolve directly to the matching written guide. The built-in source is labeled PhysiqueQuest; it does not claim provider media or attribution.
- New Coach plan generation adds equipment-matching PhysiqueQuest candidates to the existing bounded provider selection. Matching normalized names are deduplicated in favor of the provider record. The existing equipment, movement-family and condition filters still apply.
- Existing saved plan versions and completed sessions are preserved. They are not silently regenerated. The new candidates are used when the existing app creates a new program; changes to a saved program's training context follow the existing versioning behavior.
- The additional candidates require no new database reads, external API requests, video downloads or pose inference. The public manual source works independently of ExerciseDB; normal ExerciseDB requests still report their own failures. Coach generation retains its existing provider dependency.
- All 50 built-in entries are **manual logging** exercises. They do not claim GIF demonstrations or expanded automatic rep-counting support. Existing local squat/curl/floor-push-up counting presets retain their separate supported scope.
- Timed holds use seconds. Unilateral instructions explain whether to log each side as a separate set or count alternating repetitions.
- The optional admin seed command now imports 50 entries using insert-only upserts and preserves administrator edits. This is separate from the built-in public source; no live seed or database change was performed during this task.

## Validation

359 backend tests passed across 46 files, including catalog identity, instructions, search/filter/pagination, plan candidate deduplication, equipment filtering and insert-only seed preservation. All 115 frontend Node checks, frontend/backend production builds and lint checks passed. Browser checks cover source switching, written guides without fabricated demonstrations, filters, existing ExerciseDB details, narrow layouts and connected workout flows. No new inference model or native dependency was added.
