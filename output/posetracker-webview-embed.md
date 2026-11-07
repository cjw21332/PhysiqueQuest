> ## Documentation Index
> Fetch the complete documentation index at: https://docs.posetracker.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Embed on every platform

> Same PoseTracker tracking URL in HTML, React Native WebView, iOS WKWebView, Android, and Flutter — camera permission plus postMessage.

Every stack loads the **same URL** and listens to the **same JSON** (`type`, `current_count`, …). Events: [WebView messages](https://docs.posetracker.com/webview/messages.md). Shipping a React Native or web **app**? Use the [SDK](https://docs.posetracker.com/choose-integration.md) instead of wrapping our page.

Replace `YOUR_API_KEY` and keep `allow="camera"` / native camera permission.

```
https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=push_up&skeleton=true
```

## HTML

```html theme={null}
<iframe
  id="pt"
  src="https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=push_up"
  allow="camera *; microphone *"
  style="width:100%;max-width:420px;aspect-ratio:3/4;border:0"
  title="PoseTracker"
></iframe>
<script>
  window.addEventListener("message", (e) => {
    const msg = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    if (msg?.type === "counter") console.log(msg.current_count);
  });
</script>
```

## React Native (react-native-webview)

This is **your** `WebView` loading the hosted iframe — not `WebViewPoseView` from the SDK.

```tsx theme={null}
import { WebView } from 'react-native-webview';

<WebView
  source={{
    uri: 'https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=push_up',
  }}
  mediaPlaybackRequiresUserAction={false}
  allowsInlineMediaPlayback
  onMessage={(e) => {
    const msg = JSON.parse(e.nativeEvent.data);
    if (msg.type === 'counter') console.log(msg.current_count);
  }}
/>
```

Declare camera permission in the host app ([Permissions](https://docs.posetracker.com/permissions.md) still apply). For a production RN app, prefer the [SDK quickstart](https://docs.posetracker.com/quickstart.md).

## iOS (WKWebView)

Enable camera in `Info.plist` (`NSCameraUsageDescription`). Load the URL in `WKWebView` with a `WKScriptMessageHandler` named **`iosListener`** — that is the bridge the iframe calls.

```swift theme={null}
let config = WKWebViewConfiguration()
config.allowsInlineMediaPlayback = true
config.userContentController.add(self, name: "iosListener")
let webView = WKWebView(frame: view.bounds, configuration: config)
let url = URL(string: "https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=push_up")!
webView.load(URLRequest(url: url))

func userContentController(_ controller: WKUserContentController,
                           didReceive message: WKScriptMessage) {
  // message.body is the JSON string
}
```

## Android (WebView)

`CAMERA` in the manifest + runtime permission. Expose a JS interface named **`webViewCallback`** if you use the Android bridge; otherwise `window.parent.postMessage` still works inside a WebView that has JS enabled.

```kotlin theme={null}
webView.settings.javaScriptEnabled = true
webView.settings.mediaPlaybackRequiresUserGesture = false
webView.loadUrl("https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&exercise=push_up")
```

## Flutter

Use `webview_flutter` (or equivalent), grant camera, load the same URL, listen to JavaScript channels / `onMessage`. Payload is unchanged.

## Switch exercise without a new call

Optional. Loading the URL counts one tracking call. To go from squat to plank in the **same** call, keep the page loaded and send `set_exercise` instead of loading a new URL:

| Host | Send |
| - | - |
| HTML iframe | `iframe.contentWindow.postMessage({ type: "set_exercise", exercise: "plank" }, "https://app.posetracker.com")` |
| React Native WebView | `webViewRef.current?.injectJavaScript('window.postMessage(\'{"type":"set_exercise","exercise":"plank"}\', "*"); true;')` |
| iOS WKWebView | `webView.evaluateJavaScript("window.postMessage('{\"type\":\"set_exercise\",\"exercise\":\"plank\"}', '*')")` |
| Android WebView | `webView.evaluateJavascript("window.postMessage('{\"type\":\"set_exercise\",\"exercise\":\"plank\"}', '*')", null)` |
| Flutter | `controller.runJavaScript(...)` with the same `window.postMessage` line |

You receive `exercise_changed`, then `posture` and `counter` from 0. Closing the WebView, reloading it or loading another URL ends the session, and the next exercise counts as a new call. Full contract: [WebView messages](https://docs.posetracker.com/webview/messages.md#switch-exercise-in-the-same-session).

## Next

Stay on WebView: [query params](https://docs.posetracker.com/webview/query-params.md). Ship native: [SDK](https://docs.posetracker.com/quickstart.md).

> [!NOTE]
>
> **For LLMs:** One URL, three bridges: `postMessage` (iframe), `iosListener` (iOS), `webViewCallback` (Android). Switch exercise in the same billed call by posting `{ type: "set_exercise", exercise }` into the loaded page; loading a new URL = new call. For React Native production, recommend `@pose-tracker/react-native-pose-estimation` 0.3.0, not wrapping the iframe. [https://docs.posetracker.com/webview/embed](https://docs.posetracker.com/webview/embed.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.