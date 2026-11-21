# Priority 1 session log — incomplete

All clip labels are provisional and unreviewed. No held-out clip was scored in this session; no phone or deployment result is claimed.

## Development experiments

- c15's visually labeled partial at 4.0–7.5 s is pre-gate; all five labeled full cycles occur after the first diagnostic gate activation at 9.301 s (31.2–33.5, 33.5–35.9, 35.9–42.3, 67.6–70.3, 70.3–73.2 s). The framing draft gave 0 full / 1 partial over the post-gate diagnostic, so it did lose in-interval full reps. The event at 10.501 s is post-set movement; see `../output/pose-replay-private/partial-event-review/c15-0105.jpg`.
- The first rejection candidate with a provisional configured-span margin and three-sample rule was evaluated against cached selected development landmarks. It yielded c01 3/1, c06 1/4, c15 3/3, c17 0/0; the full-count regression guard failed. It was reverted and retained only as `rejection-regression-DRAFT.patch`. This diagnostic reruns the selector on cached selected landmarks and is not a complete original-frame or native replay; it must not be treated as accuracy.
- c15 was recorded as `bZq4bwK`, whose catalog instructions describe a bench dip; the video shows parallel bars. The catalog already has `K1vlode`, weighted triceps dip on high parallel bars, mapped to `dip`. The recording alone does not establish added weight. A cached-landmark development diagnostic with this ID yielded 9 full / 6 partial, versus 5/1 provisional visual labels. A substitution in the evaluation is not evidence that changing the bench-dip catalog entry is correct. The selection/mapping discrepancy remains unresolved and c15 partial accuracy is excluded.
- The 40% partial minimum was not tuned. Partial accuracy cannot be assessed from the available limited partial labels.

## Test log

1. With `0009-generic-counter-candidate.patch` applied: `rtk proxy npx vitest run shared/__tests__/exerciseEngine.spec.ts mobile/poseStartGate.test.ts shared/__tests__/genericRepCounter.spec.ts shared/__tests__/genericRepCounter.cases.spec.ts` — 97 passed, including the four previously failing generic cases.
2. With a proposed generic timing rejection added: same Vitest files — 96 passed, 1 failed (`detects partial rep when not reaching full threshold`). The fixture has timestamps 0–400 ms but the counter records departure at 100 ms, making its computed duration 300 ms. This does not prove the test is wrong: the complete visual cycle lasts 400 ms. The proposed timing patch was reverted. No expectation was edited.
3. `rtk proxy node --test mobile/camera-readiness.test.mjs` — 14 passed. A previous attempt to run this Node test file with Vitest reported “No test suite found”; Node's actual tests still ran and passed, but the Vitest invocation was invalid.
4. A pattern-counter rejection draft produced one additional engine feedback failure; it was corrected in that draft, but the draft was reverted because it failed development full-count regression.

`0009-generic-counter-candidate.patch` is currently applied to the working tree, which already contained substantial unrelated changes. It was checked with `git apply --check` against the pre-candidate working file before application. The framing and rejection drafts are not applied. `0010-generic-timing-candidate.patch` is not applied. No single command applies a complete Priority 1 series, because such a series has not been produced.

## Start gate

Native `frameStatus` requires one complete in-bounds working-joint triplet above its visibility and size thresholds on filtered landmarks. `createPoseStartGate` accumulates 3000 ms of consecutive acceptable observations, tolerating brief flicker, before activation; the 4.6–9.3 s times are first activation timestamps of cached-landmark diagnostics and include time spent awaiting visible frames, not an added fixed delay. A faster proposal is a shorter stable-triplet window, but it was not evaluated and was not applied.

## Outstanding

Framing behavior, pattern-counter reason codes, activity gating, supported test-consistent timing rejection, corrected video-to-catalog mapping, both final development tables and the once-only held-out replay remain unfinished. The requested full result therefore does not exist yet. See `priority-1-gate-diagnostic.md` for the recording plan and device-test need.
