> ## Documentation Index
> Fetch the complete documentation index at: https://docs.posetracker.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebView query parameters

> Every tracking-URL parameter PoseTracker reads: token, exercise, streams, overlay, timer, jumps. difficulty is not wired.

All live-camera parameters go on:

```
https://app.posetracker.com/pose_tracker/tracking
```

This page lists only flags **the tracking page actually reads**. Overlay, silhouette, and timer colors exist **only on this URL**. The SDK uses component props and `options.features` instead — [Provider & client](https://docs.posetracker.com/reference/provider-client.md) and the [param map](https://docs.posetracker.com/reference/features-plans.md#webview-param--sdk-map).

Upload uses a **different path** and extra flags: [Upload tracking](https://docs.posetracker.com/webview/upload.md).

## Required

| Param | Example | Role |
| - | - | - |
| `token` | `YOUR_API_KEY` | Dashboard API key (`api_uuid`). Always required on this URL. |

## What to track

You may omit all three for **keypoints-only** (pose stream, no reps). If you set more than one, the page returns an error.

| Param | Example | Role |
| - | - | - |
| `exercise` | `push_up` | Catalog id — [Exercises](https://docs.posetracker.com/reference/exercises.md) |
| `userExercise` | UUID | Custom movement from PoseTracker Studio. **WebView only** — the SDK does not take this UUID |
| `reference` or `reference_movement` | UUID | [Reference movement](https://docs.posetracker.com/webview/reference-movement.md). **WebView only** |

> [!NOTE]
>
> Query params are read once, when the page loads. Changing any of them (including `exercise=` or `userExercise=`) reloads the page, so it ends the session and **counts a new tracking call**. To switch exercise inside the same call, keep the URL and post `{ type: "set_exercise", exercise }` or `{ type: "set_exercise", userExercise }`. See [WebView messages](https://docs.posetracker.com/webview/messages.md#switch-exercise-in-the-same-session). Not available with `reference`.

## Streams and scoring (plan-gated)

| Param | Default | Role |
| - | - | - |
| `skeleton` | `true` | `true` / `false`, or a skeleton `api_uuid` |
| `keypoints` | `false` | Raw keypoints **during** an exercise (paid). Pose-only (no exercise) always streams |
| `angles` | `false` | Joint-angle stream — paid |
| `progression` | `false` | 0–100 within the current rep or hold — paid |
| `recommendations` | `false` | Form cue strings — paid. **Not emitted for every exercise**; always use `counter.form_score` for the counted-rep grade |
| `minGrade` | — | `A`…`D` — only count reps at or above this grade |
| `userHeightCm` | — | **Required** for `jump_analysis` |
| `devicePitchDeg` | — | Jump camera-tilt compensation |
| `scoring_profile` | `kali-analysis` when `reference` is set | Reference mode: `default` \| `kali` \| `kali-analysis` |

Plan matrix: [Features & plans](https://docs.posetracker.com/reference/features-plans.md).

## Layout and boot

| Param | Role |
| - | - |
| `width` / `height` | Pixel size of the camera surface |
| `isAndroid` or `android` | `true` — Android WebView tweaks |
| `loading_message` | Boot overlay copy |
| `postureBox` | Legacy placement box (`true` / `false`) |

## Placement overlay and timer

Hosted-page appearance. Ignored if you are not using this tracking URL.

| Param | Example | Role |
| - | - | - |
| `placementOverlay` | `true` | Gray padding + start-pose silhouette |
| `placementZoneColor` | `#19221f` | Fill outside the safe zone |
| `placementOverlayOpacity` | `0.45` | Zone opacity `0`–`1` |
| `placementImageOpacity` | `0.9` | Custom placement image opacity `0`–`1` |
| `placementBoxStrokeColor` | `#e2e2ef` | Safe-zone border |
| `silhouetteColor` / `silhouetteShadow` | hex | Silhouette stroke / halo |
| `silhouette` | `false` | Hide the mannequin |
| `placementZone` | `false` | Hide the gray padding |
| `timer` | `3` or `true` | Post-placement countdown (`true` → 3 s) |
| `timerSeconds` | `5` | Override when `timer=true` |
| `timerBg` / `timerColor` / `timerBorder` | hex | Timer card |
| `guide` | `true` | Orbit rings (e.g. `shoulder_roll`). Off by default |
| `engineDebug` | `true` | Internal HUD — **do not ship** |
| `placementOverlayImageUrl` | URL | Custom placement art |
| `paddingHorizontal` / `paddingVertical` / `paddingLeft` / `paddingRight` / `paddingTop` / `paddingBottom` | number | Placement insets |

## Pose model (WebView only)

These flags exist on the hosted page. The **SDK rejects** them as `features` (`feature_not_supported`). On the SDK, BlazePose is `options.model = 'blazepose'` (light / web packages only).

| Param | Default | Role |
| - | - | - |
| `blazepose` | `false` | Use BlazePose on the hosted page (plan-gated) |
| `poseBackend` | `webgl` | `webgl` or `wasm` |
| `runInWorker` | `true` | Worker inference |
| `poseEngine` | `tfjs` | Pose runtime |
| `mediapipeModel` | `lite` | MediaPipe model when BlazePose is on |

## Common URLs

Live exercise:

```
https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=push_up&skeleton=true
```

Keypoints only (no reps):

```
https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY
```

Paid streams + overlay:

```
https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=shoulder_roll&skeleton=true&keypoints=true&angles=true&progression=true&placementOverlay=true&timer=3
```

Jump analysis (height required):

```
https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=jump_analysis&userHeightCm=178
```

## Not on this URL

| Name | Where it lives |
| - | - |
| `difficulty` | SDK `startExercise(id, { difficulty })` only — **not read** here |
| `userExercise` / `reference` | WebView only — not on the npm SDK yet |
| Overlay / timer / guide | WebView only — SDK hosts draw their own UI |
| Pixel tracking | Separate product — not on this site |

Leave undocumented query flags unset.

## Related

* [WebView messages](https://docs.posetracker.com/webview/messages.md)
* [WebView vs SDK param map](https://docs.posetracker.com/reference/features-plans.md#webview-param--sdk-map)

> [!NOTE]
>
> **For LLMs:** WebView params live on `https://app.posetracker.com/pose_tracker/tracking`. Required: `token`. Optional: one of `exercise`, `userExercise`, `reference` (omit all for keypoints-only). Do not document `difficulty` as a WebView param. Overlay/timer params are WebView-only. `userExercise` and `reference` are WebView-only. Changing any query param reloads the page = a new tracking call; switch exercise in the same call with postMessage `set_exercise`. [https://docs.posetracker.com/webview/query-params](https://docs.posetracker.com/webview/query-params.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.