> ## Documentation Index
> Fetch the complete documentation index at: https://docs.posetracker.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebView messages

> postMessage contract for the PoseTracker WebView — initialization, counter, keypoints, errors, jumps, upload extras, set_exercise.

The hosted page sends JSON to the host. Browser embeds use `window.parent.postMessage(JSON.stringify(data), "*")`. iOS uses `webkit.messageHandlers.iosListener`. Android uses `window.webViewCallback`. **Same `type` field** in all three.

SDK apps should prefer typed callbacks (`onCounter`, `onKeypoints`, …). `onMessage` on the SDK is this classic shape. Full SDK catalog: [Events](https://docs.posetracker.com/reference/events.md).

## Transport

```js theme={null}
window.addEventListener("message", (event) => {
  let msg = event.data;
  if (typeof msg === "string") {
    try { msg = JSON.parse(msg); } catch { return; }
  }
  if (msg && msg.type) handle(msg);
});
```

## Real-time boot

| `type` | Shape | When |
| - | - | - |
| `initialization` | `{ message, ready? }` | `checking you plan and access` → `accessing webcam` → `loading pose model` (`ready: false`) → `running` (`ready: true`) |
| `error` | `{ error, message, current_count?, origin? }` | Failures. May include `webgl_unavailable`, `backend_fallback_wasm`, `backend_fallback_cpu` |

Live camera is `type: "initialization"` with `ready: true` and `message: "running"`.

## Pose and exercise

| `type` | Key fields |
| - | - |
| `keypoints` | `data: [{ name, x, y, score }]` — 17 COCO joints, x/y normalized 0–1 |
| `angles` | `data: { left_side, right_side }` — needs `angles=true` + paid plan |
| `counter` | `current_count`, optional `form_score: { score, avg_score, grade }`, optional `reference_score` in reference mode, optional `analysis` on a [physical test](https://docs.posetracker.com/reference/physical-tests.md) |
| `form_score` | Convenience `{ score, avg_score, grade }`. Authoritative counted-rep grade is on `counter.form_score` |
| `posture` | `message`, `direction`, `requirements`, `ready` |
| `progression` | `value` 0–100. Flag `progression=true` |
| `recommendations` | `data: string[]`. Flag `recommendations=true`. Not sent for every exercise — use `counter.form_score` for the grade |
| `exercise_summary` | End of run: `counter`, optional `history[]`. A physical test adds `disclaimer`, `method`, and `history[].analysis` |

Outside an exercise (pose-only URL), keypoints stream without extra flags. During an exercise, keypoints need `keypoints=true` + a paid plan.

## Switch exercise in the same session

Host → PoseTracker, optional. If you never send it, nothing changes: the URL loads, places, counts and is billed exactly as before.

While the tracking page is open (`/pose_tracker/tracking` with `exercise=` or `userExercise=`), the host can switch the exercise **without reloading**:

| Inbound `type` | Shape |
| - | - |
| `set_exercise` | `{ type: "set_exercise", exercise: "plank" }`. Catalog id, same values as the `exercise=` query param |
| `set_exercise` | `{ type: "set_exercise", userExercise: "<uuid>" }`. Your Studio movement (owner API key) |

What happens:

* The camera and pose model keep running. Placement, the countdown (`timer=`) and the counter restart for the new exercise, like a first entry in the frame.
* PoseTracker replies `{ type: "exercise_changed", exercise, userExercise }` (`userExercise` is `null` for catalog ids), then the usual flow: `posture`, then `counter` from 0.
* **No new tracking call is billed.** The whole page load counts as one call, so squat then plank then lunge in the same open iframe = 1 call.
* Send exactly one of `exercise` or `userExercise`. Not available with `reference=` or in pose-only mode (no exercise in the URL).
* Unknown id, both fields, or not allowed in this mode → `{ type: "error", error: "invalid_exercise", message }`, and **the current exercise keeps running**. Sending the id already running is ignored.

```js theme={null}
const iframe = document.getElementById("posetracker");
// Plain object or JSON string, both accepted.
iframe.contentWindow.postMessage(
  { type: "set_exercise", exercise: "plank" },
  "https://app.posetracker.com"
);
```

In a React Native WebView (or a native WKWebView / Android WebView), run the post inside the page:

```js theme={null}
webViewRef.current?.injectJavaScript(
  `window.postMessage(${JSON.stringify(JSON.stringify({ type: "set_exercise", exercise: "plank" }))}, "*"); true;`
);
```

> [!WARNING]
>
> The session ends, and the next exercise **counts as a new call**, if you: close or unmount the iframe / WebView, reload it, change its `src` (any query param, including `exercise=`), navigate away, or the camera is stopped. To chain exercises for one call, keep the same page open and send `set_exercise`.

## Jumps

`jump_analysis` and `air_time_jump`:

| `type` | Notes |
| - | - |
| `jump_calibration` | `jump_analysis` only — `cmPerPixel`, `baselineY` |
| `jump_started` | Push-off |
| `jump_height` | Live then `final` |
| `jump_discarded` | `reason`, `userMessage` |
| `jump_result` | Completed jump N — `jumpHeightCm` |
| `jump_summary` | Totals + `jumps[]` |

`jump_analysis` requires `userHeightCm`. Missing → `error` `jump_analysis_missing_height`.

## Upload extras

On [upload tracking](https://docs.posetracker.com/webview/upload.md) only:

| `type` | Notes |
| - | - |
| `export_ready` | `{ url }` when export is enabled and allowed |
| `keypoints_batch` | Batched keypoints for video |

Upload init messages differ (`loading video`, `%` progress, `Analysis completed`).

## Reference extras

When `reference=` is set, `counter` may include `reference_score`: `{ overallScore, nccScore, dtwScore, timingScore, distScore?, grade }`. See [Reference movement](https://docs.posetracker.com/webview/reference-movement.md).

## Related

* [WebView query parameters](https://docs.posetracker.com/webview/query-params.md)
* [SDK events](https://docs.posetracker.com/reference/events.md)
* [Features & plans](https://docs.posetracker.com/reference/features-plans.md)

> [!NOTE]
>
> **For LLMs:** WebView events are JSON with `type`. Counter field is `current_count`. SDK typed callback uses `count` / `formScore`. To chain exercises in one billed call, post `{ type: "set_exercise", exercise }` (or `userExercise`) to the open iframe; changing the iframe URL or closing it starts a new call. [https://docs.posetracker.com/webview/messages](https://docs.posetracker.com/webview/messages.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.