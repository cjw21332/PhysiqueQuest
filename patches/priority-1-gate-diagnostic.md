# Priority 1: gate diagnostic and partial-evaluation recording plan

All labels and counts are provisional and unreviewed. No tracking patch or new model inference was run. The diagnostic reprocesses the previously saved selected landmark stream with the current native `frameStatus`, `createPoseStartGate`, display filter, and pattern counter. It models the native frame branches, including updating the counter when framing is not OK; the screen recording lacks the actual camera, pause, error and lifecycle events, and subject selection/model inference are not repeated. It is not a full phone replay.

| Development clip | Ungated baseline full / partial | Native-gate diagnostic full / partial | First gate activation |
|---|---:|---:|---:|
| c01 rear pull-up | 4 / 1 | 3 / 0 | 4.901 s |
| c06 preacher curl | 3 / 4 | 3 / 3 | 6.101 s |
| c15 dip, incorrect catalog mapping | 5 / 4 | 5 / 8 | 9.301 s |
| c17 bench press | 5 / 3 | 2 / 3 | 4.601 s |

The c17 provisional visual labels put two complete cycles at 0.0–1.8 s and 1.8–3.6 s, before gate activation; a third begins at 3.6 s. The c01 first labeled rep begins at 3.2 s, before activation. Therefore a gate-faithful run cannot generally be compared against the ungated baseline's whole-clip counts as if the two measured the same interval. Nor does the gate automatically eliminate the setup/hold and post-set events: c06 emits partials at 10.201 and 12.401 s, and c15 emits partials after 10.5 s. `mobile/PoseTrackerNative.tsx` updates the counter even on non-OK framing; the start gate tolerates visibility loss for three seconds. A correct evaluation needs both ungated regression and gate-eligible interval reporting, with pre-gate movement explicitly excluded rather than backfilled or invented.

The `c15` recording maps to `triceps_extension`, although the movement is a parallel-bar dip. This is a separate catalog mapping defect. Exclude c15 from partial accuracy evaluation pending confirmation; its post-set diagnostic remains useful for detecting false activity.

## New recordings for a partial-repetition evaluation set

Record original camera video only, not a screen recording and with no skeleton, counters, countdowns, banners, or editing. Keep the entire working limb and equipment endpoints visible. Start filming at least five seconds before moving, hold the start position still, and remain in frame for five seconds after finishing. Record the actual exercise and camera viewpoint in the filename, and keep any independent rep notes separate from the tracker output.

For each exercise below, record **two sets at each listed angle**, each set containing **5 full reps followed by 5 deliberate partial reps**, with a brief rest between groups. That gives 20 full and 20 partial reps per exercise. Include at least one slow set and one comfortable faster set at each angle; avoid deliberately unsafe loading. If a full cycle cannot be seen, label it ambiguous rather than guessing.

| Exercise | Angles | Per angle | Total per exercise |
|---|---|---|---|
| Bench press | Side and front-oblique, with both elbow and bar endpoints visible | 2 sets: 5 full + 5 partial each | 20 full + 20 partial |
| Machine chest press | Side and front-oblique | 2 sets: 5 full + 5 partial each | 20 full + 20 partial |
| Preacher curl | Side and front-oblique with handle and working arm visible | 2 sets: 5 full + 5 partial each | 20 full + 20 partial |
| Front pulldown | Side and front-oblique with bar, elbows, and torso visible | 2 sets: 5 full + 5 partial each | 20 full + 20 partial |
| Parallel-bar dip | Side and front-oblique with elbows and torso visible | 2 sets: 5 full + 5 partial each | 20 full + 20 partial |
| Seated row | Side and front-oblique with handle and elbow visible | 2 sets: 5 full + 5 partial each | 20 full + 20 partial |

Use at least two participants where possible, varied loading and some pauses at endpoints, plus separate clips with an empty apparatus and another person walking through. For an occlusion subset, make additional side and oblique bench videos with a plate sometimes blocking one arm while the other remains visible; do not label hidden endpoints as known. Keep a separate untouched set for final evaluation. This plan adds evidence and does not imply current partial accuracy or phone performance is known.
