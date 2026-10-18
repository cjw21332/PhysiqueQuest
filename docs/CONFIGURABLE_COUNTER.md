# Configurable counter engine — October 18, 2026

This upgrade implements the expandable movement engine and adds selected-exercise counting. It also prepares a trained phase-classification path, but does not ship or activate an unvalidated trained model.

## Registry and shared cycle engine

`shared/repCounter.ts` now defines each family through `movementDefinitions`: left/right landmark indices, image or preferred-world measurement space, posture/measurement function, ready/active thresholds, stable-position time, minimum motion time, maximum sampling gap, smoothing weight, repetition cap and user cues. `createConfiguredRepCounter` validates that definition and runs the shared ready → active → ready cycle. New movements do not require another copy of the cycle engine.

The previous nine families retain their image measurements and posture guards through compatibility adapters. Existing preset IDs and stored workout results are preserved. Automatic squat labeling now rejects a visible split stance to avoid treating a stationary lunge as a squat. Public phase names remain compatible with the current UI. New summaries use `rep-counter-v5`; existing heuristic identification retains `movement-rules-v3`.

## Expanded selection: 27 presets across 12 families

Seven new presets:

- Bodyweight hip hinge, dumbbell Romanian deadlift and barbell Romanian deadlift.
- Glute bridge and dumbbell glute bridge.
- Stationary lunge (split squat) and dumbbell stationary lunge.

Hinges require a nearly extended knee and standing leg geometry, bridges require a lying posture with bent knees and planted feet, and stationary lunges require both legs visible in a split stance. Bridge cycles begin and end with hips lowered; hinge/lunge cycles begin and end upright. Stationary lunges keep the same lead leg for a set. Alternating walking/reverse lunges and arbitrary deadlift variations are not enabled by these rules.

These additions require explicit preset selection before local counting. Automatic suggestions still cover five generic families. All added rules are experimental and need reviewed counts, labeled real clips and physical-device evaluation.

## Estimated 3D handling

The web worker and native camera now send matching image/world subsets through `selectTrackingFrame`. New families prefer world-coordinate joint angles when present; existing families remain in image space. Confidence and camera/posture gates still use visible image landmarks. Missing world output uses image measurement; malformed world points are rejected. Changing spaces resets an unfinished movement, preventing one repetition from combining incompatible measurements. Completed reps are retained.

World coordinates are estimated by MediaPipe, not measured anatomy or a calibrated motion-capture system. No second pose inference, model download, remote pose processing or per-frame persistence is added. See [MediaPipe's output documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

## Trainable classifier and temporal counting

`shared/poseClassifier.ts` extracts body-relative pose features and implements a bounded nearest-neighbour phase classifier. Its model declares image/world coordinates, supported movement/side/phase labels, distance rejection and minimum vote fraction. Equal-distance ties are included in voting. Ambiguous, distant or poorly visible poses produce no label. Vote fraction is not a calibrated probability.

`createLearnedExerciseIdentifier` passes accepted phases through the same cycle timing engine. It does not count each recognized frame as a repetition. Static/mixed/incomplete motion remains inconclusive. Generic movement names do not infer equipment. The recorded analyzer accepts an optional classifier, but the shipped UI supplies none until a candidate has real validation evidence. Classifier identity is propagated into saved algorithm-version metadata.

The approach follows the general phase-classification/repetition-counting workflow in [Google's pose classification guide](https://developers.google.com/ml-kit/vision/pose-detection/classifying-poses), with project-specific validation and unknown handling.

## Offline training and evaluation

Run from the root:

```powershell
node scripts/train-pose-classifier.mjs labeled-motion.json artifacts/pose-candidate.json
```

Input shape:

```json
{
  "source": "Dataset provenance/link and collection version",
  "license": "Verified usage license",
  "coordinates": "image",
  "rows": [{
    "clipId": "opaque-clip-id",
    "groupId": "opaque-person-or-recording-session-id",
    "split": "train",
    "label": {"kind": "hiphinge", "side": "left", "phase": "ready"},
    "frame": {"timestamp": 100, "aspect": 1.7778, "joints": []}
  }]
}
```

The empty joints above is a schema illustration, not a usable training example. Supply the actual 33 normalized landmarks with visibility, and matching 33 x/y/z world landmarks for a world-space model. Each movement/side needs both phases and at least two independent training groups. Hold validation subjects/sessions and clip IDs apart from training; include unknown/unsupported examples with `label: null` in validation. `groupId` must identify the actual shared person/session, not a different arbitrary ID for each frame. The tool rejects group/clip leakage and invalid landmarks, and never trains on the validation rows.

The candidate file includes provenance and a held-out confusion table, match/rejection counts and unknown false accepts. These are phase-classification results only. Thresholds are candidate defaults, not established accuracy targets. Candidate output does not activate the app or certify rep accuracy. Do not train from RepDB's guide JSON: it is a different data format and lacks the required human motion sequences.

Before activation: validate rep-count error over complete held-out clips, exercise precision/recall, unknown false positives, occlusion/camera-angle tolerance and Android latency/memory/battery. Set acceptance targets before evaluating. Review dataset permissions, consent and provenance. No trained production candidate was created from the supplied RepDB source; a suitable motion dataset remains required.

## Verification

An isolated [Qualcomm benchmark research workflow](QEVD_RESEARCH.md) now audits temporal annotations, extracts local landmarks and evaluates manually reviewed segments. Benchmark data is excluded from training and app distribution; no verified motion accuracy result exists yet.

Verified on October 18, 2026: all 194 frontend/mobile Node checks and 56 browser checks passed; the production frontend build, frontend/mobile TypeScript checks, frontend lint and Android export passed. The Android export contains 1,398 modules, a 5.1 MB Hermes bundle and the existing 5.8 MB pose model.

Execution logs are under local `artifacts/configurable-*`. Tests cover compatibility with existing counters, all new families, configuration validation, estimated depth, image/world changes, invalid confidence, shared transport indexing, leakage rejection, ambiguous classifier votes, the CLI candidate/report path and temporal phase counting. Synthetic fixtures verify implementation, not human accuracy. Browser checks cover the real prepared RepDB display module, attribution/illustrations, local video review/save, and existing workout flows. Native export/type checks do not replace a signed Android installation and camera test.
