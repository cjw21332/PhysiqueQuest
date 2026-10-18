# Automatic rep-counter expansion — October 18, 2026

The on-device counter now exposes **27 presets across 12 rule families**. The latest configurable-engine additions are described in [the engine implementation report](CONFIGURABLE_COUNTER.md). Automatic exercise suggestions remain limited to squat, biceps curl, standard floor push-up, overhead press and lateral raise; rows, triceps extensions, hip hinges, bridges and stationary lunges require explicit preset selection.

## Added selectable presets

| Preset | Counting rule | Required view / visible landmarks |
|---|---|---|
| Bodyweight hip hinge | Upright → hip hinge → upright | Side; shoulder, hip, knee, ankle |
| Dumbbell Romanian deadlift | Same hip-hinge rule | Side; weight clear of tracked joints |
| Barbell Romanian deadlift | Same hip-hinge rule | Side; bar clear of tracked joints |
| Glute bridge | Hips down → lift → hips down | Low side; shoulder, hip, knee, ankle |
| Dumbbell glute bridge | Same bridge rule | Low side; weight clear of tracked hip |
| Stationary lunge (split squat) | Upright split stance → lower → rise | Side; both knees/ankles, selected hip/shoulder |
| Dumbbell stationary lunge | Same stationary-lunge rule | Same lead leg per set |
| Dumbbell bent-over row | Straight arm → pull → lower with a hinged torso | Side view; hip, shoulder, elbow, wrist, knee |
| Single-arm dumbbell row | Same row cycle; one arm per set | Side view; keep the support clear of tracked joints |
| Overhead triceps extension | Extended → bent → extended elbow with upper arm overhead | Side or slight angle; hip, shoulder, elbow, wrist |
| Resistance band biceps curl | Existing curl rule | Side view; shoulder, elbow, wrist |
| Barbell biceps curl | Existing curl rule; selected arm only | Side view; shoulder, elbow, wrist clear of the bar |
| Kettlebell goblet squat | Existing squat rule | Side view; hip, knee, ankle |
| Standing overhead press | Elbow extension overhead → bend near shoulder level → extension | Front or slight angle; hip, shoulder, elbow, wrist |
| Seated overhead press | Same press cycle, with an upright seated torso | Front or slight angle; hip and arm unobstructed by chair |
| Dumbbell lateral raise | Arm down → shoulder-height raise → arm down | Front; hip, shoulder, elbow, wrist |
| Resistance band lateral raise | Same shoulder-elevation cycle | Front; same landmarks |
| Knee push-up | Extended → bent → extended elbows, shoulder/hip/knee alignment | Low side view; shoulder, elbow, wrist, hip, knee |
| Wall push-up | Extended → bent → extended elbows, upright body and hands forward | Side view; shoulder, elbow, wrist, hip, ankle |
| Close-grip push-up | Existing standard floor-push-up cycle | Low side view; shoulder, elbow, wrist, hip, ankle; hand spacing is not measured |

Bodyweight/goblet/sumo squats, standing/hammer/seated curls and standard push-ups remain available. Bilateral movements count the selected arm/side once; counts from both sides are never added together.

## How to use it

From Camera check, choose **Upload video**. Automatic scanning now considers squat, biceps curl, floor push-up, overhead press and lateral raise. For a row, overhead triceps extension, specific variation or knee/wall push-up, disable automatic identification, select the matching exercise and visible side, then choose **Count reps locally**. Review/correct the result before saving.

For a planned workout, open **Use a recorded video for this set**, choose a matching counting rule, select the clip and save its reviewed result. This retains the planned exercise/set identity. A timed hold still uses seconds rather than a rep-counting rule. The public catalog retains manual labels; it does not automatically assign an experimental counting rule to every exercise.

## Guardrails and resource use

- New rules reuse the same local Lite pose model, worker and video pass. No additional model download, remote pose service, backend inference or per-frame persistence was added. Existing model assets can still download on first use.
- The shared cycle engine retains smoothing, separate return/depth thresholds, stable-position timing, minimum cycle time, ordered timestamps, confidence checks and motion resets on joint loss, pause or a sampling gap.
- Presses require both arm elevation and elbow flexion/extension so a fixed overhead triceps bend is rejected. Lateral raises require a mostly extended elbow and a return to arms-down. Automatic lateral-raise suggestions require both shoulders visible with enough horizontal separation; a side-on view is inconclusive.
- Rows require a hinged torso, visible knee below the hip and an arm working below the shoulder. Overhead triceps extensions require the upper arm overhead throughout the cycle; normal shoulder-press lowering is rejected by that rule. These posture gates are experimental, not assessments of form.
- Automatic scanning now evaluates ten small counters (five families, two sides) against each pose result. This adds landmark arithmetic, not a second inference pass. No measured battery/latency percentage improvement is claimed.
- Generic suggested presses/raises retain empty equipment until a user explicitly selects a variation. Rows, overhead triceps extensions and knee/wall push-ups are selectable counting rules, not newly recognized automatic labels. Variations, hand spacing and equipment are not inferred reliably from these rules.
- Stored summaries use `rep-counter-v5` or `movement-rules-v3/rep-counter-v5`. Prior summaries retain their original versions. Detected counts and user-reviewed counts remain separate.
- The Android bridge accepts the shared list of supported kinds. Its existing foreground/thermal limits remain in force. Hidden live-camera beta entry points remain hidden; native validation below does not certify physical-camera operation.

## Verification and limits

The current verification results are recorded in [the configurable-engine report](CONFIGURABLE_COUNTER.md). Synthetic landmark tests cover all new rules, both automatic-identification sides, portrait/landscape aspect handling, incomplete reps, missing/uncertain joints, stale/duplicate frames, motion resets, posture rejection and ambiguous camera views. Browser scenarios cover selected and automatically identified counting, one model request per sampled frame, corrected reps, versioned result metadata, private-media exclusion and report reload. Frontend production build, lint, mobile TypeScript and Android Hermes export passed.

These are implementation and integration checks, not an exercise-accuracy study. New movements remain experimental until labeled real clips and physical Android devices establish rep-count error, false positives, camera-angle tolerance and performance. No new form score or injury/safety judgment is produced. Retain manual entry and review when a clip cannot be counted.

Movement references: [ACE single-arm row](https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/), [ACE bent-over row](https://www.acefitness.org/resources/everyone/exercise-library/12/bent-over-row/), and [NASM modified push-up](https://www.nasm.org/resource-center/exercise-library/modified-push-up). These sources describe movements, not validation or endorsement of these counting rules. Full operating guidance: [camera and recorded-video guide](CAMERA_TRACKING.md).
