# Real-time squat movement preview

Historical proof-of-concept report. The user-facing entry has since been replaced by the catalog-aware PoseTracker integration; see [POSETRACKER_INTEGRATION.md](POSETRACKER_INTEGRATION.md). The local preview code is retained, not offered as an automatic fallback. Measurements below describe the earlier MediaPipe experiment only.

This is an experimental local proof of concept, not validated form assessment or medical advice. In the Exercise Library, search for `bodyweight squat`, open the row marked **Experimental squat preview** (ExerciseDB ID `6YUfHPL`), and choose **Try squat movement preview**. The preview is separate from saved workouts and does not upload, record, or store video. Other catalog exercises remain unsupported; no catalog-wide AI support is implied.

## Technology decision

| Technology | Browser suitability | Decision |
| --- | --- | --- |
| [QuickPose Web SDK](https://quickpose.ai/web-sdk/) | Its official web page currently asks developers to register interest; no usable browser SDK documentation was located. | Not selected for the web proof of concept. |
| [QuickPose React Native](https://quickpose.ai/products/react-native/) | Wraps native iOS/Android SDKs, with on-device processing. The vendor says custom native modules are needed and Expo Go is not supported. | A possible future native integration, not a browser SDK. |
| [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) | Official JavaScript support, 33 landmarks, browser/WASM inference, and local video processing. | Selected: the existing project already bundles the runtime and lite model. |
| [TensorFlow.js models](https://www.tensorflow.org/js/models) | Browser ML models are available. | Viable alternative, but would duplicate the existing MediaPipe stack. |

QuickPose's [pricing](https://quickpose.ai/sdk-pricing/) lists a free tier for 10 monthly devices and paid plans starting at $25/month for 100; check current terms before purchase. Its [terms](https://quickpose.ai/terms-and-conditions/) describe Apache 2.0 licensing subject to its agreement and potential fees. MediaPipe's [repository license](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE) is Apache 2.0; review the bundled model's upstream terms and the existing `frontend/public/pose/THIRD_PARTY_NOTICES.md` before distribution. ExerciseDB's separate data/media terms also apply.

## Existing integration and architecture

- `useCameraStream` owns browser permission, preview, disconnection, tab visibility and track cleanup; the native bridge is separate and requires the existing custom native build.
- `pose.worker.ts` initializes the bundled MediaPipe WASM and lite model and maps MediaPipe landmarks to normalized hip/knee/ankle input. The worker is the replaceable provider boundary; `useRepTracking` manages lifecycle, frame scheduling and stale-frame handling.
- `shared/repCounter.ts` defines the exercise registry, landmark confidence, aspect-corrected joint angle, threshold configuration, dwell timing, movement state and rep count. The screen only presents its output; it does not decide angles.
- `SquatFormPreview` is a local session with an explicit camera start/stop, side selection, and an unsaved summary. The catalog identifier is mapped explicitly; IDs are not inferred from exercise names.

The web camera requires HTTPS or localhost and permission. The current worker runs the lite model on CPU, scales frames to at most 480 pixels wide, and adapts its target interval from 100 to 500 ms. The tab-hidden and unmount paths stop capture and terminate the worker. Model and WASM files must be available from the application origin; the existing offline library shell does not guarantee that tracking assets are cached offline.

## Rules and support

The catalog squat is **partially supported**: selected-side hip, knee, and ankle must have visibility of at least 0.65 (and presence at least 0.65 when supplied). A 2D knee angle at or above 155° establishes standing; at or below 105° establishes a bend. Stable observations must persist for 150 ms, and a bend must persist for at least 300 ms before a return can count. A frame gap above 600 ms or an invalid joint clears the in-progress motion. A sustained intermediate bend can prompt the user that the counter needs a larger knee bend; it is not a recommendation to exceed a comfortable range. Thresholds are uncalibrated heuristics, not clinical or biomechanical validation.

The support type also reserves **supported**, **unsupported**, and **requires special setup**. No exercise is claimed to have validated form rules. Unregistered ExerciseDB IDs are unsupported. The existing curl counter remains an internal special-setup prototype and is not exposed as catalog support by this feature.

The preview cannot verify side-on orientation, distinguish occlusion from some model errors, assess knee alignment, back position, depth in 3D, pain, load, or injury risk. Incorrect camera angle, loose clothing, occlusion, lens distortion and lighting can cause missed or false reps. A detected movement is not proof of correct form. There is no validated accuracy rate.

## Verification and next work

Synthetic landmarks test complete cycles, partial movement, missing or low-confidence landmarks, frame gaps and unsupported IDs. A browser test feeds synthetic landmark sequences through a mocked provider to verify the visible adjustment, rep count and summary; that is not an accuracy evaluation. Separate browser tests use Chromium's fake camera and the real bundled MediaPipe worker to test initialization, denied permission, disconnection, repeated starts, stopping tracks and session summary. One local Chromium fake-camera run reached camera/worker readiness in 1,168 ms; its first three worker-reported inference durations were approximately 217, 22 and 24 ms. These are three samples from a fake feed, not a person-based accuracy, sustained-throughput, CPU/GPU utilization, battery, or mobile-device benchmark.

Before claiming reliable form feedback, collect consented, representative recordings across camera angles, clothing, skin tones, body types, mobility ranges and devices; label motion with qualified reviewers; measure false counts, missed counts, confidence failures and subgroup performance; and calibrate thresholds. Suitable next candidates for separate evaluation include a standing curl and a front-view squat alignment check, but neither should be marked validated without its own evidence.
