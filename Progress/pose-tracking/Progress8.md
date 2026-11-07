# Experimental browser tracker checkpoint

`frontend/workers/pose.worker.ts` now supports a separate generic-frame message carrying ephemeral MediaPipe landmarks to `frontend/hooks/useGenericRepTracking.ts`. The hook schedules frames, initializes the existing local model, updates the generic counter and calls its stall timer. `frontend/sections/Coach/GenericTrackingSession.tsx` supplies browser camera controls, an experimental warning, live repetition and partial counts, progress and cue, and an unsaved summary. It disables fault checks for all generated configurations pending calibration. `PoseTrackerSession.tsx` selects this component only for eligible generated-angle configurations.

Checks: from `frontend`, `rtk npm run build` returned exit code 0 and `Compiled successfully`; `rtk proxy node --test tests/pose-tracker.test.mjs` returned `tests 8; pass 8; fail 0`. From `shared`, `rtk npx vitest run --config vitest.config.ts` returned `Tests 19 passed (19)`.

NOT COMPLETE: no generated configs are available for a real user, import writes remain disabled, no real camera exercise has been run, and the new component has not received an end-to-end browser camera test. Developer-only landmark recorder, consent and withdrawal flow, evaluator, synthetic evaluation and classifier format are not implemented. No claim of readiness for real-user testing or accuracy is made.
