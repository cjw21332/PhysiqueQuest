> ## Documentation Index
> Fetch the complete documentation index at: https://docs.posetracker.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Exercises

> Catalog exercise ids for WebView (?exercise=) and SDK (startExercise) — reps, holds, jumps, aliases.

This is the **canonical exercise list** for both integrations.

* **WebView:** `?exercise=push_up` — [query parameters](https://docs.posetracker.com/webview/query-params.md)
* **SDK:** `startExercise('push_up')` after a successful `apiToken` handshake

Without a key, the SDK stays on [keypoints](https://docs.posetracker.com/keypoints.md) only. The WebView tracking URL always needs `token=`.

After the SDK handshake, prefer the live list:

```ts theme={null}
const { client, startExercise, stopExercise } = usePoseTracker();
client.getAvailableExercises();
client.getAvailableCustomExercises(); // jump_analysis, air_time_jump
```

Plan gating can hide premium ids. Unknown id → `invalid_exercise`.

## Start / stop (SDK)

```tsx theme={null}
function CameraScreen() {
  const { startExercise, stopExercise, mode } = usePoseTracker({
    onCounter: (e) => console.log(e.count, e.formScore?.grade),
    onPosture: (e) => console.log(e.ready, e.hint),
  });

  // when mode === 'full-engine' and status === 'ready':
  // startExercise('push_up');

  return <WebViewPoseView style={{ flex: 1 }} drawSkeleton drawPlacementBox />;
}
```

### StartExerciseOptions

| Option | Type | Default | Used by |
| - | - | - | - |
| `difficulty` | `string` | `'medium'` | SDK only (not a WebView query param) |
| `userHeightCm` | `number` | — | **Required** for `jump_analysis` |
| `devicePitchDeg` | `number` | — | Jump camera-tilt compensation |

```ts theme={null}
startExercise('push_up');
startExercise('face_squat'); // alias → squat
startExercise('jump_analysis', { userHeightCm: 178, devicePitchDeg: 5 });
startExercise('air_time_jump');
stopExercise();
```

## Several exercises in one session

A tracking call is one open session, not one exercise. Switch with the same ids:

* **WebView:** keep the iframe open and post `{ type: "set_exercise", exercise: "plank" }` (or `userExercise`). See [WebView messages](https://docs.posetracker.com/webview/messages.md#switch-exercise-in-the-same-session).
* **SDK:** call `startExercise('plank')` again while the camera is still open.

Placement, countdown and counter restart for the new exercise. Closing the iframe or the camera, or changing the iframe URL, ends the session: the next exercise counts as a new call. See [What counts as one tracking call](https://docs.posetracker.com/reference/features-plans.md#what-counts-as-one-tracking-call).

## Catalog

Use these ids on the WebView (`exercise=`) and in `startExercise()`.

### Strength and cardio

| Id | Kind | Alias |
| - | - | - |
| `squat` | rep | `face_squat` |
| `push_up` | rep | `face_pushup` |
| `plank` | hold | `face_plank` |
| `lunge` | rep | `face_lunge` |
| `side_lunge` | rep | — |
| `deadlift` | rep | — |
| `glute_bridge` | rep | — |
| `calf_raise` | rep | — |
| `tricep_dip` | rep | — |
| `bicep_curl` | rep | — |
| `hammer_curl` | rep | — |
| `shoulder_press` | rep | — |
| `lateral_raise` | rep | — |
| `mountain_climber` | rep | — |
| `high_knees` | rep | — |
| `jumping_jack` | rep | `face_jumping_jack` |
| `low_impact_jack` | rep | `face_low_impact_jack` |
| `leg_raise` | rep | — |
| `wall_sit` | hold | — |
| `balance_leg` | hold | `face_balance_leg` |
| `balance_leg_left` | hold | `face_balance_leg_left` |
| `balance_leg_right` | hold | `face_balance_leg_right` |

### Mobility and wellness

| Id | Kind |
| - | - |
| `shoulder_roll` | rep |
| `shoulder_deep_breath` | rep |
| `chair_forward_fold` | hold |
| `chair_side_stretch` | hold |
| `split` | hold |
| `facial_split` | hold |
| `pancake` | hold |
| `closing` | hold |
| `bridge` | hold |
| `cobra` | hold |
| `bow` | hold |
| `tiger` | hold |
| `camel` | hold |
| `king_pigeon` | hold |
| `foot_to_hand` | hold |
| `i` | hold |
| `needle` | hold |

### Physical tests

These ids count like any other exercise, and each counted rep also includes an `analysis` object. Field list and the first test: [Physical tests](https://docs.posetracker.com/reference/physical-tests.md).

| Id | Kind | Setup |
| - | - | - |
| `back_flexibility_test` | rep | Side view. Stand, fold, stand. Not a tape measure. |

### Jumps (custom)

Shipped in the engine bundle, not only the movement list.

| Id | Required options |
| - | - |
| `jump_analysis` | `userHeightCm` (> 0) — WebView: `&userHeightCm=178` |
| `air_time_jump` | none (`jump` is an alias) |

Missing height on `jump_analysis` → `jump_analysis_missing_height`.

**Session:** placement (`onPosture`) → countdown → measuring.

| Typed callback | Message `type` |
| - | - |
| `onJumpCalibration` | `jump_calibration` (`jump_analysis` only) |
| `onJumpStarted` | `jump_started` |
| `onJumpHeight` | `jump_height` |
| `onJumpDiscarded` | `jump_discarded` |
| `onJumpResult` | `jump_result` |
| `onJumpSummary` | `jump_summary` |

## Other aliases

| Alias | Resolves to |
| - | - |
| `face_squat` | `squat` |
| `face_pushup` | `push_up` |
| `face_plank` | `plank` |
| `face_lunge` | `lunge` |
| `face_jumping_jack` | `jumping_jack` |
| `face_low_impact_jack` | `low_impact_jack` |
| `face_balance_leg` | `balance_leg` |
| `face_balance_leg_left` | `balance_leg_left` |
| `face_balance_leg_right` | `balance_leg_right` |
| `jump` | `air_time_jump` |

## Events during an exercise

Always (not feature-flagged): `counter` / `onCounter` (count + form grade A–F), `posture`, `exercise_summary` on stop. Physical tests also set `analysis` on that counter — [Physical tests](https://docs.posetracker.com/reference/physical-tests.md).

Paid opt-in: `angles`, `progression`, `keypoints` during the session, `recommendations` (not sent for every exercise). See [Features & plans](https://docs.posetracker.com/reference/features-plans.md) and [Events](https://docs.posetracker.com/reference/events.md).

## Related

* [WebView quickstart](https://docs.posetracker.com/webview/quickstart.md)
* [API key](https://docs.posetracker.com/api-key.md)
* [Events](https://docs.posetracker.com/reference/events.md)

> [!NOTE]
>
> **For LLMs:** Same exercise ids on WebView (`?exercise=`) and SDK (`startExercise`). Jumps: `jump_analysis` needs `userHeightCm`. Aliases `face_*` and `jump` → `air_time_jump`. Physical tests (`back_flexibility_test`) add `analysis` on the counter. Chain ids in one billed session: WebView postMessage `set_exercise`, SDK repeated `startExercise` with the camera open. [https://docs.posetracker.com/reference/exercises](https://docs.posetracker.com/reference/exercises.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.