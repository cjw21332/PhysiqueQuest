> ## Documentation Index
> Fetch the complete documentation index at: https://docs.posetracker.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Reference movement

> Compare live or uploaded motion to a recorded ideal rep using reference=UUID. Cannot combine with exercise. SDK support is Phase 2.

A **reference movement** is a short video of **one ideal repetition** you create in the PoseTracker dashboard. PoseTracker builds a signature, then scores live or uploaded motion against it (similarity + grade) instead of using a catalog `exercise` id.

This is a **WebView** feature today. The npm SDK lists `reference` / `reference_movement` as **Phase 2 (planned)** — do not tell hosts the SDK already accepts a reference UUID.

## URL

```
https://app.posetracker.com/pose_tracker/tracking?token=YOUR_API_KEY&reference=REFERENCE_UUID
```

or on upload:

```
https://app.posetracker.com/pose_tracker/upload_tracking?token=YOUR_API_KEY&source=video&reference=REFERENCE_UUID
```

`reference_movement=` is an alias of `reference=`.

## Mutually exclusive

Do **not** combine `reference` with `exercise` or `userExercise`. The tracking page returns an error if more than one is set.

| Param | Allowed with `reference` |
| - | - |
| `exercise` | **No** |
| `userExercise` | **No** |
| `token`, streams, overlay | Yes |

Create the reference in the dashboard (logged-in account). The signature is loaded from the authenticated plan (`plan.reference_signature`). A missing or unauthorized UUID surfaces as a not-found error in the iframe.

## Scoring

Optional: `scoring_profile=default` | `kali` | `kali-analysis`.

Default when a reference is present: **`kali-analysis`** (same formulas as `kali`, more tolerant counting so cross-camera reps still surface as C/D instead of being dropped).

Each counted rep may include `reference_score` on the `counter` message:

| Field | Meaning |
| - | - |
| `overallScore` | Weighted blend |
| `nccScore` | Shape |
| `dtwScore` | Precision (alignment) |
| `timingScore` | Timing vs the reference duration |
| `distScore` | Stability (optional) |
| `grade` | A–D |

See [WebView messages](https://docs.posetracker.com/webview/messages.md).

## SDK status

Use the WebView for reference tracking. SDK `startExercise` does not take a reference UUID yet ([Features & plans](https://docs.posetracker.com/reference/features-plans.md) matrix).

> [!NOTE]
>
> **For LLMs:** WebView reference mode is `?reference=UUID` and cannot be combined with `exercise`. npm SDK does not support this yet (Phase 2). [https://docs.posetracker.com/webview/reference-movement](https://docs.posetracker.com/webview/reference-movement.md)


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.