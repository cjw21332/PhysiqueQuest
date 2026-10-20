# Phase 1: Camera Readiness — Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
Implement truthful camera setup assistance in the existing camera-check screen using installed local pose models. Four independent evidence channels: fresh camera frames, visible full body, scene brightness and approximate framing. Preserve current workout/API flows. This document records user choices and scope, not implemented behavior.
</domain>

<decisions>
### Locked Decisions

- **D-01:** Use on-device analysis with existing MediaPipe assets; readiness must not upload/store camera frames or depend on the external pose provider.
- **D-02:** Give approximate framing guidance; remove live-readiness claims of verified 2.5–3 meter distance.
- **D-03:** Keep manual workout continuation available with camera off, denied, unavailable or unsupported. Unsupported and ambiguous checks remain unknown.
- **D-04:** Integrate browser and native development-build adapters in the existing Next.js/Expo architecture; preserve rep-tracking/upload contracts and API-backed workout records.
- **D-05:** In-progress readiness is ephemeral memory only; close/reopen starts fresh checking. Never restore a saved green result. Lifecycle changes invalidate old observations and release resources.
- **D-06:** Preserve the PhysiqueQuest Design System, text scaling, accessible status labels and at least 48px/dp touch controls.
- **D-07:** Validate synthetic edge cases automatically and record real-device calibration separately; no accuracy or physical-device claims without evidence.

### Implementation Discretion

Exact internal filenames, compact observation shape, calibrated thresholds and small status-copy refinements. Preserve the current preview geometry and explicitly project source coordinates to its visible crop. Suggested numeric thresholds in research are hypotheses, not approved product guarantees. Use the smallest shared evaluator and platform adapters; no new dependencies or general framework.
</decisions>

<specifics>
User requested GSD planning, authorized initialization for this existing project, then explicitly selected on-device checks and approximate framing guidance. No implementation or native migration requested in this run.

Current callers: CameraCheck, useCameraStream, worker, mobile/App and NativeTrackingCamera. Existing regressions: device-readiness, pose-flow, mobile-redesign, browser pose-tracking and backend pose-analysis tests. Read research for precise contracts and installed source evidence.
</specifics>

<deferred>
Measured meter ranging; backlight/subject-region lighting guarantees; broader form analysis; native UI migration; policies; external services; media storage; database changes.
</deferred>
