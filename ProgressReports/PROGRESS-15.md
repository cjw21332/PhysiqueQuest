# Progress Report 15 — PhysiqueQuest v2.5.0

**Date:** October 12, 2026  
**Release branch:** `PhysiqueQuest-v2.5.0`  
**Also publishing to:** `main`  
**Status:** Inactivity emergency-check implementation integrated across the backend, Expo host, and web app; camera-check flow refreshed; automated validation passed.

## Overview

This report records the system changes assembled for the v2.5.0 release branch since Progress Report 14. The main addition is an inactivity emergency check for live workouts. It detects stillness using the phone's accelerometer, asks the user to confirm they are okay, and, if the countdown expires, sounds an alarm and attempts to notify the saved emergency contact. The backend records the event and exposes a privacy-limited admin log.

The implementation is designed for Expo Go while the app is open and the screen is on. It does **not** claim to monitor a locked phone, continue in the background, or change the phone's volume. The camera-check screen was also updated to use a real camera stream and the existing backend pose-analysis status instead of presenting invented measurements.

## 1. Workout inactivity and emergency flow

### Detection and state transitions

- Added a framework-independent state machine in [inactivityMachine.mjs](../mobile/inactivity/inactivityMachine.mjs). Its states are monitoring, countdown, alarm, and stopped.
- The Expo host samples the accelerometer at 10 Hz. A change greater than `0.08 g` between samples counts as movement; a 1-second timer advances the inactivity state machine.
- The configured inactivity threshold is used (30, 45, or 60 seconds; 45 seconds is the default). At the threshold, the web view displays a 30-second “Are you okay?” countdown.
- Movement during the countdown or tapping “I'm okay” cancels it and returns the session to monitoring. The machine records a `cancelled` event; cancelled events are not sent to the emergency-contact provider.
- When the countdown expires, the host captures foreground location if permission is granted and a fix arrives within five seconds. If permission is unavailable or the fix times out, the alert still proceeds without coordinates.
- During a live workout, the host requests keep-awake and releases the sensor subscription and keep-awake state when monitoring stops. The web view and Expo host exchange session, countdown, alarm, and stop events over their existing bridge.
- The pure state-machine and movement-detector tests cover the exact threshold boundary, countdown timing, movement and user cancellation, spike handling, stop behavior, and invalid thresholds.

### Workout interface and alarm

- Added an emergency countdown view and alarm view in [InactivityViews.tsx](../frontend/sections/Coach/InactivityViews.tsx). The countdown shows the time remaining, workout/exercise context, and saved emergency-contact name.
- The alarm screen reports the backend delivery status and whether a location was shared. It requires a continuous three-second hold to stop; releasing early resets progress. Pointer and keyboard interactions are supported.
- [LiveSession.tsx](../frontend/sections/Coach/LiveSession.tsx) starts and stops the Expo monitor, converts host events to backend records, starts and stops the alarm sound, and resolves an inactivity alert after a completed hold.
- Alarm audio uses the Web Audio API at the phone's **current** volume. The application does not set or raise device volume.
- Added the shared alarm-audio helper, alert status/badge helpers, and the corresponding styles and UI tests.

## 2. Backend alerts, ownership, and admin visibility

- Extended the alert schema and request validation to support `manual`, `inactivity`, and `cancelled` event types; `pending`, `delivered`, `failed`, and `cancelled` statuses; optional location, workout-session and exercise details; and alert resolution/flagging fields.
- Emergency submissions carry an idempotency key. Existing records are reused for duplicate submissions so a retry does not send the same alert twice.
- A cancelled countdown creates a record without contacting the provider. A real inactivity alert is sent only when the delivery provider and the user's emergency contact are configured. Unavailable delivery and unconfigured contacts are recorded as failed with an explicit error code.
- Added an owner-checked resolve endpoint. Only the owner can resolve their inactivity alert; resolving a non-inactivity alert is rejected.
- Added an admin alert list with 7-, 30-, and 90-day ranges, optional status filtering, and a 200-record limit. The response includes whether a location was shared, never the coordinates.
- Location is included with the alert only when available. It is stored with the alert record and must be treated as personal data; application logs and the admin list do not expose its coordinates.

## 3. Camera-check refresh

- Added [useCameraStream.ts](../frontend/hooks/useCameraStream.ts) to acquire and release a browser camera stream, prefer the rear-facing camera, retry with any camera when that constraint is unavailable, and report permission, device, and secure-context failures to the user.
- Updated [CameraCheck.tsx](../frontend/sections/Coach/CameraCheck.tsx) to show the live camera feed and honest readiness states. Pose-analysis readiness comes from the backend status endpoint; no distance or pose score is fabricated.
- The upload-video path previews a selected video locally and offers analysis only when the backend reports the provider is available. It validates supported MP4/MOV types and a 20 MB upload size limit before submitting.
- Updated the corresponding camera-check UI guard to verify use of the real stream and backend readiness check rather than requiring the former static “Live pose tracking is unavailable” message.

## 4. Design, implementation notes, and maintenance safety

- The approved runtime constraints and data flow are recorded in [2026-10-12-inactivity-emergency-design.md](../docs/superpowers/specs/2026-10-12-inactivity-emergency-design.md). The implementation checklist and review-focus cases are in [2026-10-12-inactivity-emergency.md](../docs/superpowers/plans/2026-10-12-inactivity-emergency.md).
- The Expo dependencies for sensors, keep-awake, and foreground location are pinned to SDK-compatible versions in the mobile package.
- Secured [delete-user.ts](../backend/scripts/delete-user.ts): it no longer contains an embedded account address or prints the database connection string. It now requires an explicit target email, `MONGODB_URI`, and the `--confirm-delete` flag. **This script was not run.** It remains a destructive maintenance tool; use it only against the intended database after confirming the target.

## 5. Verification performed

| Check | Result |
|---|---|
| Frontend production build (`npm run build --workspace frontend`) | Passed; optimized build, TypeScript, and static route generation completed. |
| Frontend UI guard tests (`npm run test:ui-guard --workspace frontend`) | Passed: 14 tests. |
| Frontend inactivity helper and mobile state-machine tests (`node --test ...`) | Passed: 17 tests. |
| Backend full unit suite (`npm run test --prefix backend`) | Passed: 30 files, 245 tests. |
| Backend production build (`npm run build --prefix backend`) | Passed. |
| Expo host TypeScript check (`npx tsc --noEmit --project mobile/tsconfig.json`) | Passed: no TypeScript errors. |

The full backend run emits expected provider-test log messages and a Vite configuration deprecation notice; neither caused a test failure.

## 6. Configuration and follow-up checks

1. **Configure delivery before relying on contact notification.** Set `ALERT_DELIVERY_URL` and `ALERT_DELIVERY_API_KEY` for the backend's existing alert-delivery provider. Without a configured provider or a saved emergency contact, the event is recorded but delivery cannot be confirmed.
2. **Exercise the flow on real Android and iOS devices in Expo Go.** Confirm sensor permission/availability, strap placement and movement sensitivity, the foreground location prompt, alarm audibility at the current phone volume, countdown cancellation, and the three-second stop hold.
3. **Check platform boundaries with users.** Detection, location capture, countdown, and alarm require the app to remain open with the screen on. A browser does not provide the Expo accelerometer stream; a locked or backgrounded app is not covered.
4. **Verify deployment access.** Confirm the admin alert-log route is available only to the intended administrators and that location coordinates remain excluded from the API response and logs.
5. **Camera permissions require a supported secure context.** On a browser phone, use HTTPS (or localhost where applicable); test the Expo/WebView path separately from a desktop browser.

Automated builds and tests passed, but physical-device sensor, permission, and audio behavior and live provider delivery were not exercised in this environment.
