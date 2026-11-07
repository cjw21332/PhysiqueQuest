> ## Documentation Index
> Fetch the complete documentation index at: https://docs.posetracker.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Features & plans

> Feature flags, plan gating matrix, form grades, watermark, and error messages.

The **SDK** and the **WebView** share the same plan gating and error messages. SDK keypoints without a token are free; the WebView tracking URL always needs `token=`. Overlay/timer colors stay WebView-only.

## Free vs paid

| | No API key | With API key |
| - | - | - |
| Keypoints (pose-only) | **Free** — offline package needs no network; light needs CDN/model | Same |
| Movement engine / exercises | No | Yes (handshake + metering) |
| Developer streams (`angles`, …) | Blocked | Paid plans only |

With a key, internet is required to authenticate and meter (`POST /api/sdk/configure`, `POST /api/sdk/track` `camera_start`). Offline metered sessions refuse key-gated features (`offline_metered`); keypoints-only keeps running from cache.

## What counts as one tracking call

One call = one open session, not one exercise. This is how metering already works; chaining exercises is an optional extra on top.

| Integration | Counted once when… | Chain exercises in the same call | Starts a **new** call |
| - | - | - | - |
| WebView / iframe | The tracking page loads (token check) | Post `{ type: "set_exercise", exercise }` or `{ type: "set_exercise", userExercise }` to the open page. See [WebView messages](https://docs.posetracker.com/webview/messages.md#switch-exercise-in-the-same-session) | Closing, reloading or unmounting the iframe / WebView, changing its `src` (any query param, including `exercise=`), navigating away, camera stopped |
| SDK camera | `camera_start` (`POST /api/sdk/track`) when the camera opens | Call `startExercise('squat')`, then `startExercise('plank')` while the camera stays open | Unmounting `WebViewPoseView`, `stop()` then `start()`, any new camera open |
| SDK external frames | `warmupExternal()` | `startExercise()` again while `processFrame` keeps running | A new client / new `warmupExternal()` session |

On each switch, placement, the countdown and the counter restart for the new exercise; camera and model stay loaded. Example: squat then plank then lunge in the same open iframe (or the same SDK camera) = **1 call**. Close the iframe after squat, open it again for plank = **2 calls**.

## Quotas and what happens above them

| Plan | Included tracking calls | Above the included calls |
| - | - | - |
| Free | 200 / month | **Strict**: `configure` and `track` answer `429` → `quota_exceeded`; the WebView page answers `402`. Back on the 1st of the next month or after an upgrade. |
| Developer | 1,000 / month | **Soft**: calls go through, nothing changes for end users. Each extra call is counted for the calendar month. |
| Business 100k / 500k / 1M | 100,000 / 500,000 / 1,000,000 per 12-month period (no monthly cap) | **Soft**, same as Developer. The period starts the day the plan is linked to the account. |
| Managed unlimited offers | No quota | Calls are counted, never refused, no extra call. |

Soft limit, in practice: at the first extra call you receive an email and the account dashboard shows the number of extra calls this month. Within 14 days we agree together either on a higher plan (extra calls covered by the new quota) or on keeping your plan and paying the extra calls, invoiced at the end of the month at €0.01 excl. VAT per call unless another price was agreed in writing. Without an agreement in 14 days, Movelytics may switch the account to a strict limit: it then behaves like Free above the quota (`quota_exceeded`). See the [Terms of Use](https://www.posetracker.com/terms-of-use).

`plan.remainingCalls` in the handshake is informative (calls left in the current month, or in the 12-month period on Business). The SDKs never stop on that number: they only raise `quota_exceeded` on an HTTP `429`, so a soft-limited account above its quota keeps working and reads `remainingCalls: 0`.

## Feature flags

Set on the provider:

```tsx theme={null}
<PoseTrackerProvider
  apiToken="ptk_…"
  options={{
    features: {
      angles: true,
      recommendations: true,
      progression: true,
      keypoints: false, // keypoints DURING an exercise
      minGrade: 'B',
    },
  }}
>
```

| Flag | Default | Meaning |
| - | - | - |
| `angles` | `false` | Stream `angles` during exercise — paid |
| `recommendations` | `false` | Form advice strings — paid. Not sent for every exercise; use `counter` / `onCounter.formScore` for the grade |
| `progression` | `false` | 0–100 within the current rep or hold — paid |
| `keypoints` | `false` | Raw keypoints **during** an exercise — paid. Pose-only (no exercise) always streams. |
| `minGrade` | — | `'A'…'D'` — only count reps at/above this grade |

Not supported as **features flags**: `blazepose`, `poseEngine`, `mediapipeModel`,
`poseBackend`, `runInWorker` → `feature_not_supported`.
Select BlazePose with `options.model = 'blazepose'` on light / web (not via `features`).

## Plan gating matrix

Plan type from handshake (`plan.plan` / `client.getPlanType()`).

| Plan | angles / recommendations / progression | keypoints + exercise | Exercises |
| - | - | - | - |
| No key | Blocked | Blocked | No |
| `free` | **Blocked** | **Blocked** | Yes (non-premium list) |
| `developer`+ | OK if flags on | OK if flag on | Yes |

### When gating runs

1. **configure / preload** — `free` + angles/recommendations/progression → `free_plan_feature_blocked` (one-shot). Keypoints-only keeps running.
2. **`startExercise()`** — re-check; on `free`, `features.keypoints` also blocks. Throws with the same message.

### Emission filtering (during exercise)

| Event | Requires |
| - | - |
| `angles` | `features.angles` |
| `recommendations` | `features.recommendations` |
| `progression` | `features.progression` |
| `keypoints` | `features.keypoints` (outside session: always on) |
| `counter`, `posture`, `form_score`, `exercise_summary` | Always (core streams) |

## Form grades & minGrade

| Grade | Score |
| - | - |
| A | ≥ 90 |
| B | ≥ 80 |
| C | ≥ 70 |
| D | ≥ 60 |
| E | ≥ 40 |
| F | \< 40 |

Authoritative counted-rep grade: nested on `onCounter` → `formScore` (classic `counter.form_score`). Standalone `form_score` is convenience only.

`minGrade: 'B'` counts A and B only; below-bar reps emit neither `counter` nor `form_score`.

## Watermark

On the free plan, and when no API key is set, the live camera shows a dofollow link. The anchor text is **Powered by PoseTracker**. It opens `https://www.posetracker.com/` with `utm_source=watermark`. The medium is `webview` on the tracking page, `react-native` in the React Native SDK (`Linking.openURL`), and `web-sdk` in the web SDK.

Developer and Business plans do not show the link. The same removal applies to any paid plan (`developer`, `company`, `enterprise`, custom).

| Plan | Watermark on live camera |
| - | - |
| Keyless / `free` | Link shown |
| Paid | Hidden |

To remove it on a build that would otherwise show it, set `showWatermark={false}` on `WebViewPoseView` (React Native) or `showWatermark: false` in `createPoseTracker` (web). Omitting the prop keeps the plan rule. `coldStart: 'basic'` warmers never show it. A plan upgrade after `configure()` hides it without remounting.

## WebView param → SDK map

| WebView query | SDK |
| - | - |
| `token` | `apiToken` / `configure(apiToken)` |
| `exercise` | `startExercise(id, options?)` |
| `userExercise` | **WebView only** — Studio custom UUID |
| `difficulty` | SDK `startExercise(id, { difficulty })` only — **not read** by the tracking URL |
| `userHeightCm` / `devicePitchDeg` | `StartExerciseOptions` |
| `skeleton` | `drawSkeleton` / `skeletonUuid` / `skeletonDef` |
| `loading_message` | `loadingText` |
| `postureBox` | `drawPlacementBox` |
| `angles` / `recommendations` / `progression` / `keypoints` / `minGrade` | `options.features.*` |
| `reference` / `reference_movement` | **WebView only** — not in the SDK yet. See [Reference movement](https://docs.posetracker.com/webview/reference-movement.md) |
| `placementOverlay`, colors, `timer`, `guide` | **WebView only** — [query parameters](https://docs.posetracker.com/webview/query-params.md) |

## Common error codes

| Situation | `code` |
| - | - |
| Dev features, no token | `invalid_token` |
| Unknown exercise | `invalid_exercise` |
| `jump_analysis` without height | `jump_analysis_missing_height` |
| Free + developer features | `free_plan_feature_blocked` |
| Unsupported `features` keys (use `options.model` for BlazePose) | `feature_not_supported` |
| Offline + key at camera start | `offline_metered` |
| Quota used up on Free, or on an account switched to a strict limit (HTTP `429`). Paid plans above their quota keep working — see [Quotas](#quotas-and-what-happens-above-them) | `quota_exceeded` |
| Revoked token | `invalid_token` (caches purged → keypoints-only) |

## Related

* [API key](https://docs.posetracker.com/api-key.md)
* [Exercises](https://docs.posetracker.com/reference/exercises.md)
* [Events](https://docs.posetracker.com/reference/events.md)
* [WebView query parameters](https://docs.posetracker.com/webview/query-params.md)

> [!NOTE]
>
> **For LLMs:** Same gating on WebView and SDK. BlazePose is `options.model`, not a features flag. `difficulty` is SDK-only. `reference=` is WebView-only. Overlay/timer params are WebView-only. One billed call = one open session: chain exercises with `set_exercise` (iframe) or repeated `startExercise` (SDK, camera still open); closing the iframe/camera or changing the URL starts a new call. Quotas: Free 200/month strict (`quota_exceeded`); Developer 1,000/month and Business 100k/500k/1M per 12-month period are soft — calls above the quota go through, are counted as extra calls, and within 14 days the client either upgrades or pays €0.01 excl. VAT per extra call; `quota_exceeded` on a paid plan only happens after Movelytics switched the account to a strict limit. [https://docs.posetracker.com/reference/features-plans](https://docs.posetracker.com/reference/features-plans.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.