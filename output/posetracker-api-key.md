> ## Documentation Index
> Fetch the complete documentation index at: https://docs.posetracker.com/llms.txt
> Use this file to discover all available pages before exploring further.

# API key & exercises

> Optional paid movement engine — reps, form score, jumps. SDK keypoints stay free without a key. WebView tracking URL always needs token.

On the **SDK**, keypoints work **without** an API key. Pass `apiToken` when you want the remote movement engine (exercises, counter, form score, jumps, plan-gated features). The **WebView** tracking URL always requires `token=` — [WebView quickstart](https://docs.posetracker.com/webview/quickstart.md).

Get a key at [posetracker.com](https://www.posetracker.com).

## Provider with token

```tsx theme={null}
import {
  PoseTrackerProvider,
  WebViewPoseView,
  usePoseTracker,
} from '@pose-tracker/react-native-pose-estimation';

function App() {
  return (
    <PoseTrackerProvider
      apiToken="YOUR_API_KEY"
      options={{ features: { angles: true, progression: true, minGrade: 'B' } }}
    >
      <CameraScreen />
    </PoseTrackerProvider>
  );
}

function CameraScreen() {
  const { preload, startExercise } = usePoseTracker({
    onCounter: (e) => {
      console.log(e.count, e.formScore?.grade);
    },
  });

  // startExercise('push_up');

  return (
    <WebViewPoseView
      style={{ flex: 1 }}
      drawSkeleton
      skeletonUuid="OPTIONAL_CUSTOM_SKELETON_UUID"
    />
  );
}
```

Same pattern with `-light` and with the [web SDKs](https://docs.posetracker.com/web-sdks.md) (`createPoseTracker({ apiToken })`).

## WebView equivalent

```
https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=push_up&skeleton=true
```

Overlay and timer colors: [WebView query parameters](https://docs.posetracker.com/webview/query-params.md).

## What the key is billed on

One tracking call per open session: the tracking page load (WebView) or `camera_start` (SDK). Switching exercise inside that session (`set_exercise` on the iframe, `startExercise` again in the SDK) is not billed again. Closing the iframe or camera, changing the iframe URL, or `stop()` / `start()` starts a new call. Details: [What counts as one tracking call](https://docs.posetracker.com/reference/features-plans.md#what-counts-as-one-tracking-call).

## Modes

| Mode | When | Events |
| - | - | - |
| `keypoints-only` | SDK with no valid API key | Keypoints |
| `full-engine` | Handshake succeeded + engine loaded | Counter, form score, angles, … |

## Watermark

Shown for keyless and free plans. Hidden for paid plans (`developer`, `company`, `enterprise`, …). Override with `showWatermark` on `WebViewPoseView`.

## Reference

* [Exercises](https://docs.posetracker.com/reference/exercises.md)
* [Features & plans](https://docs.posetracker.com/reference/features-plans.md)
* [Events](https://docs.posetracker.com/reference/events.md)

> [!NOTE]
>
> **For LLMs:** SDK keypoints are free; exercises need `apiToken`. WebView URL always needs `token`. One billed call per open session; switching exercise inside it is not billed again. [https://docs.posetracker.com/api-key](https://docs.posetracker.com/api-key.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.