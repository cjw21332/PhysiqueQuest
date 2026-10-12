# Inactivity Emergency Check — Design

Date: 2026-10-12
Status: Approved scope, revised for Expo Go runtime. Ready for implementation plan.

## Goal

During a live workout, detect that the lifter has stopped moving. After the saved inactivity threshold (default 45 seconds) with no movement, show a 30-second "Are you okay?" countdown. If the lifter does not cancel it, sound an alarm and alert their emergency contact with their location, then show an "Emergency detected" screen that stays until the lifter holds the stop control for 3 seconds.

## Runtime: Expo Go, screen on

PhysiqueQuest is a mobile app first. The web app also runs in a browser, but the feature is built for the Expo Go app on a phone. Expo Go only runs modules bundled into the SDK, so the design uses no native code, no `expo prebuild`, no foreground service, and no background location.

- **Movement source:** the phone's accelerometer, read by the host app through `expo-sensors` (SDK 57: `expo-sensors@57.0.3`). The phone must be strapped to the lifter (armband or waist).
- **Screen-on only:** detection, countdown, and alarm run only while the app is open and the screen is on. `expo-keep-awake` (`expo-keep-awake@57.0.2`) keeps the screen on during an active session.
- **Location:** `expo-location` (`expo-location@57.0.20`), captured once when the alarm fires, while the app is in the foreground. If permission is denied or the fix takes more than 5 seconds, the alert is sent without coordinates and the screen says "Location unavailable."
- **Alarm sound:** plays with the Web Audio API inside the WebView at the device's current volume. The `AudioContext` is created and resumed inside the "Start workout" tap, which satisfies mobile autoplay rules.
- **Volume:** no device volume is changed on any platform. The existing "Maximum alarm volume" setting is kept in the data model (`alarmVolume`) but relabeled "Alarm volume (best effort)" in the UI, with the subtitle "Plays at your phone's current volume."
- **Threshold:** the existing `threshold` setting (30, 45, or 60 seconds, default 45) is the inactivity window. The 45-second value in the original design is the default.

## Decisions

| Question | Decision |
|:--|:--|
| Movement source | Phone accelerometer through `expo-sensors`. Camera frame comparison was dropped because Expo Go cannot run per-frame pixel analysis. |
| Inactivity threshold | Saved `threshold` setting: 30, 45, or 60 seconds. Default 45. |
| Countdown length | 30 seconds. |
| Alert delivery | Existing `AlertDeliveryProvider` (`ALERT_DELIVERY_URL` / `ALERT_DELIVERY_API_KEY`). Not configured today: alerts save as `failed` until set up. |
| Location in alerts | Yes, when permission is granted and a fix arrives within 5 seconds. |
| Admin alert log | In scope. Backend list endpoint plus an admin screen. |
| Screen-off behavior | Not supported. Detection, countdown, and alarm run only with the app open and the screen on, on both platforms. The session screen says so before the workout starts. |
| Platform | Expo Go on Android and iOS. Web browsers get the same screens but no accelerometer, so the session screen shows "Movement detection needs the phone app" and does not start a countdown. |

## Constraints

- A locked iPhone or an app in the background cannot detect movement or sound the alarm. This is a platform and Expo Go limit, not something the code can work around. The session screen says so.
- A web page cannot raise device volume. The alarm plays at the current volume on every platform.
- The mockups use the phone's own status bar. The app renders inside its WebView, so the status bar comes from the native layer.
- DESIGN.md allows only system fonts. The screens match the mockups' layout and colors, not their typeface.
- Mockup colors measured from the supplied images: alarm background `#A11A12`, countdown ring `#D92D20`, primary button `#88E788`, text `#101828`, page `#F6F8F6`.
- Device steps (screen-on alarm, location prompt, accelerometer on a real strap) cannot be verified by the implementing agent. They are listed as manual checks.

## Architecture

### Host app (`mobile/`)

- `mobile/inactivity/inactivityMachine.mjs`: pure state machine with no React or native imports. Testable with `node --test`.
- `mobile/App.tsx`: owns the accelerometer subscription, keep-awake, location capture, and the bridge to the WebView.
- Accelerometer samples arrive at 10 Hz. Each sample's magnitude is compared with the previous magnitude. A change above `MOVEMENT_DELTA_G` (0.08 g) counts as movement. A 1-second timer also ticks the machine so the countdown advances without movement.
- The host subscribes only while the WebView reports an active workout, and unsubscribes on stop or when the app leaves the foreground.

State machine:

`MONITORING` → (no movement for `thresholdMs`) → `COUNTDOWN` (30 s) → `ALARM` → `STOPPED`

- Movement during `COUNTDOWN` returns to `MONITORING` and emits `cancelled` with reason `movement`.
- "I'm okay" during `COUNTDOWN` returns to `MONITORING` and emits `cancelled` with reason `im-okay`.
- On entering `ALARM`, the host captures location and emits `alarm` with the location or `null`.
- Hold-to-stop in `ALARM` moves to `STOPPED`.

Bridge messages:

- WebView → host: `inactivity-start` `{ thresholdMs }`, `inactivity-stop`, `inactivity-im-okay`, `inactivity-hold-stop`, `inactivity-request-motion-status`.
- Host → WebView: `window.dispatchEvent(new CustomEvent('physiquequest-inactivity', { detail }))` with `detail.type` set to `motion-status`, `countdown-started`, `cancelled`, `alarm`, or `stopped`.

### Web layer (`frontend/`)

- `frontend/lib/inactivityConstants.mjs`: `COUNTDOWN_SECONDS = 30`, `HOLD_TO_STOP_MS = 3000`, `alertStatusText(status, errorCode)`, and `alertLogBadge(event)`. Pure functions, tested directly.
- `frontend/sections/Coach/InactivityViews.tsx`: `InactivityCountdown` (mockup 1) and `EmergencyAlarm` (mockup 2).
- `LiveSession.tsx` renders these views from the host's `physiquequest-inactivity` events. It sends the bridge messages above and creates the Web Audio context in the "Start workout" tap.
- `InactivityCountdown`: ring with remaining seconds, "Emergency check", "Are you okay?", the threshold line, the contact notice with the contact's name, and a full-width "I'm okay" button. Footer: "Also cancels automatically if movement is detected."
- `EmergencyAlarm`: bell icon, "Alarm active" (no volume claim), then "Emergency detected", the recorded time and exercise, the "Alert sent to" card with status from the backend, and "Hold to stop alarm" (3-second hold).
- Hold-to-stop requires a continuous press for 3 seconds. Releasing early resets the timer. Keyboard users hold Enter or Space for 3 seconds; progress is announced with `aria-live`.
- Status text uses backend truth through `alertStatusText`: "Delivered" only for `delivered`; "Not delivered" for `failed` (with the error reason); "Sending..." while pending; "Not sent" for `cancelled`.

### Backend (`backend/`)

- `CreateAlertDto`: `eventType: 'manual' | 'inactivity' | 'cancelled'`; optional `location` with `lat` ∈ [-90, 90], `lng` ∈ [-180, 180], `accuracyMeters` ∈ [0, 10000], `capturedAt` ISO date; optional `workoutSessionId` (Mongo ObjectId format).
- `AlertEvent` schema: `eventType` enum adds `inactivity` and `cancelled`; `status` enum adds `cancelled`; optional `location` (`lat`, `lng`, `accuracyMeters`, `capturedAt`), optional `workoutSessionId`, optional `resolvedAt`, and `flagged: boolean` (default false). The alert record is where the workout's emergency flag lives. `WorkoutSession` has no schema change.
- `pending`, `delivered`, and `failed` apply to `manual` and `inactivity` events. `cancelled` applies only to `cancelled` events.
- `SafetyService.send`:
  - `cancelled` events are stored with status `cancelled` and never call the provider.
  - `manual` and `inactivity` events include `location` and `workoutSessionId` in the provider payload. The `to` field remains the contact's phone.
  - Location is never written to application logs. It is stored on the alert record, so it is personal data (see Open risks).
- `POST /safety/alerts/:id/resolve`: sets `resolvedAt` and `flagged: true` on an `inactivity` alert owned by the caller. Idempotent: resolving an already-resolved alert returns it unchanged. Non-owners get 404.
- `GET /admin/alerts?days=30&status=`: recent alert events with user display name, event type, status, error code, time, `resolvedAt`, `flagged`, `locationShared` (boolean only), and the workout's `exerciseIds`. Protected by `JwtAuthGuard` + `RolesGuard` + `@Roles('admin')`, same pattern as `AdminAnalyticsController`. `status` is validated against the four status values.

### Admin screen (`frontend/`)

- New view in Me › Admin tools: "Emergency alert log" with the "Admin view" label and rows showing time, exercise, event type, and status badge.
- Badge meanings, from `alertLogBadge`:
  - "Open": `inactivity` alert with status `delivered` or `failed` and no `resolvedAt`. Shows "Not delivered" when the provider failed.
  - "Resolved": `inactivity` alert with `resolvedAt` set.
  - "False alarm": `cancelled` event.
- Cancelled countdowns create records with `eventType: 'cancelled'`, so the admin log can show false alarms. The provider is never called for them.

## Data flow

1. The lifter starts a workout. The session screen says the phone must be strapped on, the screen must stay on, and detection does not work on a locked phone. The Web Audio context is created in this tap. The host activates keep-awake and subscribes to the accelerometer if the `inactivity` setting is on.
2. No movement for the threshold → host emits `countdown-started` → web shows mockup 1 with 30 s.
3. "I'm okay" or movement → host emits `cancelled` → web calls `POST /safety/alerts` with `eventType: 'cancelled'` (no contact) → web returns to the session.
4. Countdown reaches 0 → host captures location (up to 5 s) and emits `alarm` → web starts the alarm sound, calls `POST /safety/alerts` with `eventType: 'inactivity'`, a generated idempotency key, location, and workout id → provider → status returned.
5. Web shows mockup 2 with the real status. Hold 3 s → web sends `inactivity-hold-stop` → host emits `stopped` and stops the sound → web calls `POST /safety/alerts/:id/resolve` → alert gets `resolvedAt` and `flagged: true` → web shows "Session ended and flagged" and the existing `complete` endpoint ends the workout.

## Error handling

- Provider not configured: alert saved as `failed` with `PROVIDER_NOT_CONFIGURED`. Screen says "Not delivered: alert provider is not configured." The alarm still sounds.
- Location denied, unavailable, or slower than 5 s: alert sent without location; screen says "Location unavailable."
- Accelerometer unavailable (web browser, or the sensor reports no samples for 5 s): screen says "Movement detection is off on this device." No countdown is started.
- App backgrounded or screen locked during a workout: the host unsubscribes and the screen shows "Detection paused while the app is in the background." No alarm is sent for that gap.
- Network loss during alert: the web layer retries with the same idempotency key up to 3 times over 60 s; the backend deduplicates on `(userId, idempotencyKey)`.
- Idempotency keys follow the existing `^[A-Za-z0-9._:-]{12,100}$` rule.

## Testing

- Backend unit: DTO validation (valid and invalid location, unknown event types, malformed `workoutSessionId`), `SafetyService` payload including location and workout id, dedupe, `cancelled` events do not call the provider, resolve owner-only and idempotent, admin endpoint rejects non-admin with 403 and rejects an unknown status.
- Mobile unit (`node --test`): state machine with a fake clock: stillness reaches countdown at exactly the threshold, movement during countdown cancels, "I'm okay" cancels, countdown reaches alarm at exactly 30 s, hold-stop moves to stopped, no alarm while monitoring.
- Frontend unit (`node --test`): constants are 30 and 3000; `alertStatusText` returns "Delivered" only for `delivered`; `alertLogBadge` for each case.
- Device (manual, not verified by the agent): Expo Go loads the app; accelerometer triggers countdown on a strapped phone; alarm sound plays with the screen on; location prompt appears and a fix is recorded; keep-awake holds the screen; background pause message appears.

## Out of scope

- Detection with the screen locked or the app in the background (Expo Go and platform limit).
- Forced device volume on any platform.
- Calls to emergency services. The alert goes only to the configured contact.
- Choosing alert providers or setting their credentials.
- Pose or form analysis.
- Native foreground services, background location, and camera frame analysis.

## Open risks

- Accelerometer detection cannot tell a lifter who is still from a lifter resting between sets. A phone on a waist strap should reduce false alarms, but the threshold setting is the main control and false alarms are possible.
- Storing alert logs with names and locations is personal data. The admin view shows only whether location was shared, but the stored coordinates still exist in the database. A retention period and a deletion path must be decided before launch.
- Web Audio autoplay rules differ between Expo Go's WebView versions. If the alarm is silent on a device, the screen still shows the alarm state, and the device test list covers this.
