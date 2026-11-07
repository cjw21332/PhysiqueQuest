> ## Documentation Index
> Fetch the complete documentation index at: https://docs.posetracker.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Events catalog

> Typed callbacks, key shapes, classic onMessage parity, and error codes.

SDK apps should use **typed callbacks**. WebView hosts use the classic JSON `type` field — [WebView messages](https://docs.posetracker.com/webview/messages.md). `onMessage` on the SDK is that classic shape.

```tsx theme={null}
usePoseTracker({
  onInitialization: (e) => {},
  onKeypoints: (e) => {},
  onCounter: (e) => {},
  onError: (e) => console.error(e.code, e.message),
  // or classic:
  onMessage: (msg) => { /* WebView sendDataToNative shape */ },
});
```

Imperative: `client.addEventListener` / `client.addMessageListener`.

[External frames](https://docs.posetracker.com/external-frames.md) (`processFrame`) emit this same catalog. The promise's `events` array is the subset produced by that frame; listeners still receive every event.

## Keypoints-only (no API token)

| Typed callback | Classic `type` | When |
| - | - | - |
| `onInitialization` | `initialization` | Boot steps; `ready: true` when inference is live |
| `onKeypoints` | `keypoints` | Every inferred pose |
| `onWarning` | `warning` | Soft issues |
| `onError` | `error` | Failures (camera, model, webview, …) |
| `onQualityChanged` | `warning` (`quality_downgraded`) | Adaptive capture downgrade |
| `onPerformanceWarning` | `error` (`device_too_slow`) | Mean inference FPS critically low |
| `onRuntimeDownloadProgress` | — | Rare remote runtime parts (legacy path) |

Business events need [full-engine](https://docs.posetracker.com/api-key.md) + [feature flags](https://docs.posetracker.com/reference/features-plans.md).

## Full-engine callbacks

| Typed | Classic `type` | Key fields |
| - | - | - |
| `onCounter` | `counter` | `count`, `formScore?: { score, average, grade }` — **authoritative** grade for the counted rep. Classic: `current_count`, `form_score: { score, avg_score, grade }`. Physical tests also set `analysis` — [Physical tests](https://docs.posetracker.com/reference/physical-tests.md) |
| `onAngles` | `angles` | `angles: [{ id, side, degrees, score }]` — flag `features.angles` |
| `onPosture` | `posture` | `ready`, `hint`, `direction?`, `missingKeypoints` |
| `onProgression` | `progression` | `value` 0–100 — flag `features.progression` |
| `onRecommendations` | `recommendations` | `recommendations: string[]` — flag `features.recommendations`. Not sent for every exercise; use `onCounter.formScore` for the counted-rep grade |
| `onFormScore` | `form_score` | Convenience; prefer `onCounter.formScore` |
| `onExerciseSummary` | `exercise_summary` | `exercise`, `counter`, `averageFormScore`, `grade`, `history[]`. A physical test also sets `disclaimer`, `method`, and `history[].analysis` |
| Jump family | `jump_*` | See [Exercises](https://docs.posetracker.com/reference/exercises.md) |

Outside an exercise session, pose-only `keypoints` always stream (free). During an exercise, keypoints need `features.keypoints` + a paid plan.

## Key shapes

### KeypointsEvent

| Field | Type | Notes |
| - | - | - |
| `keypoints` | `{ name, x, y, score }[]` | 17 COCO joints; x/y normalized 0–1 (mirrored preview) |
| `score` | `number` | Mean pose confidence |
| `timestampMs` | `number` | Frame time |

Classic `onMessage`: joints in `data` instead of `keypoints`.

### InitializationEvent

| Field | Notes |
| - | - |
| `step` | `configuring` \| `downloading` \| `warming` \| `accessing_webcam` \| `loading_media` \| `loading_pose_model` \| `ready` |
| `message` | Human string (WebView parity, e.g. `"running"`, `"accessing webcam (source=camera)"`) |
| `ready` | `true` when live |
| `mode?` / `acceleration?` | On ready |

Camera boot sequence (classic messages): `accessing webcam` → `loading pose model` → `running` (`ready: true`).

### CounterEvent / form grades

| Grade | Score |
| - | - |
| A | ≥ 90 |
| B | ≥ 80 |
| C | ≥ 70 |
| D | ≥ 60 |
| E | ≥ 40 |
| F | \< 40 |

`minGrade` (A–D): reps below the bar are **not counted** (no `counter` / `form_score`, excluded from summary). Physical-test peaks live on `analysis`, not in this table.

### QualityChangedEvent

`previousProfile`, `activeProfile`, `reason` (`low_fps` | `device_capability` | `crash_guard` | `warmup_estimate` | `manual`), `detail`, optional `estimatedFps` / `medianInferenceMs`.

### PerformanceWarningEvent

`code: 'device_too_slow'`, `meanFps`, `thresholdFps`, `activeProfile`, `message` (English, for developers — localize before showing end users).

## Error codes

| `code` | Typical cause |
| - | - |
| `invalid_token` | Bad/revoked token, or developer features without a token |
| `quota_exceeded` | Quota used up on Free, or on an account switched to a strict limit (HTTP `429`). Paid plans above their quota keep working — see [Features & plans](https://docs.posetracker.com/reference/features-plans.md#quotas-and-what-happens-above-them) |
| `network` / `network_required` | Handshake or required download failed |
| `offline_metered` | API key present but camera\_start metering needs network — keypoints-only continues |
| `free_plan_feature_blocked` | Free plan + angles / recommendations / progression / keypoints+exercise |
| `feature_not_supported` | Unsupported `features` keys (e.g. `{ blazepose: true }`) — use `options.model` for BlazePose on light/web |
| `invalid_exercise` | Unknown exercise id |
| `jump_analysis_missing_height` | Missing `userHeightCm` |
| `model_load_failed` / `engine_load_failed` / `integrity_check_failed` | Load / cache integrity |
| `webview_error` | WebView / page failure |
| `device_too_slow` | Also as `performance_warning` |
| `backend_fallback_wasm` | GPU → WASM path |
| `internal` | Unexpected |

Messages for plan gating match the WebView product strings.

## HUD vs your UI

The in-page yellow debug HUD is **not** your app’s event stream. Drive UI from `usePoseTracker` / listeners only.

## Related

* [Keypoints quick page](https://docs.posetracker.com/keypoints.md)
* [Features & plans](https://docs.posetracker.com/reference/features-plans.md)
* [Adaptive quality](https://docs.posetracker.com/advanced/adaptive-quality.md)

> [!NOTE]
>
> **For LLMs:** SDK typed callbacks use `count` / `formScore`. WebView classic JSON uses `current_count` / `form_score`. Grades A≥90 B≥80 C≥70 D≥60 E≥40 F\<40. Physical tests also set `analysis`. [https://docs.posetracker.com/reference/events](https://docs.posetracker.com/reference/events.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.