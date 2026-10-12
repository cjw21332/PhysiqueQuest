# Inactivity Emergency Check — Design

Date: 2026-10-12
Status: Draft for review

## Goal

During a live workout, detect that the lifter has stopped moving. After 45 seconds of no movement, show a 30-second "Are you okay?" countdown. If the lifter does not cancel it, sound an alarm and alert their emergency contact with their location, then show an "Emergency detected" screen that stays until the lifter holds the stop control for 3 seconds.

## Decisions (from review)

| Question | Decision |
|:--|:--|
| Movement source | On-device camera frame comparison. Frames are never uploaded. |
| Inactivity threshold | 45 seconds without detected movement. |
| Countdown length | 30 seconds. |
| Alert delivery | Existing `AlertDeliveryProvider` (`ALERT_DELIVERY_URL` / `ALERT_DELIVERY_API_KEY`). Not configured today: alerts save as `failed` until set up. |
| Location in alerts | Yes. Sent with the alert request. Requires location permission. |
| Admin alert log | In scope. Backend list endpoint plus an admin screen. |
| Screen-off behavior | Android: detection, countdown, and alarm keep running via a foreground service. iPhone: detection, countdown, and alarm run only while the app is open and the screen is on. |
| Platform | Native development build via `expo prebuild`. Not runnable in Expo Go. |

## Constraints

- iOS does not allow camera capture in the background. An iPhone with the screen locked cannot detect movement or sound the alarm. This is a platform limit, not something the code can work around. The spec says so on the session screen before the workout starts.
- A web page cannot raise the device volume. Android can raise the alarm stream volume; iPhone can only play at the current volume through the alarm audio channel.
- The mockups use the phone's own status bar. The app renders inside its WebView, so the status bar comes from the native layer.
- DESIGN.md allows only system fonts. The screens will match the mockups' layout and colors, not their typeface.
- Mockup colors measured from the supplied images: alarm background `#A11A12`, countdown ring `#D92D20`, primary button `#88E788`, text `#101828`, page `#F6F8F6`.

## Architecture

### Native layer (`mobile/`)

- `InactivityMonitor` module (Kotlin for Android, Swift for iOS, behind one TypeScript interface).
- Camera frames are read at 2 fps, downscaled, and compared against the previous frame. Changed-pixel ratio above a threshold counts as movement. Frames stay in memory and are discarded after comparison.
- State machine: `MONITORING` → (45 s no movement) → `COUNTDOWN` (30 s) → `ALARM` → `STOPPED`. Movement during `COUNTDOWN` returns to `MONITORING` and cancels the countdown. "I'm okay" returns to `MONITORING`.
- On entering `ALARM`: start the alarm sound on the alarm audio channel, request location, and call the backend.
- The native layer publishes state changes to the WebView with `injectJavaScript`, and receives "I'm okay" and "hold to stop" messages through `onMessage`.
- Android foreground service with a persistent notification while a workout is active, declared with the camera and location foreground-service types (Android 14+ requires them for background camera and location access).
- Permissions: camera, location (when in use and background), notifications.

### Web layer (`frontend/`)

- `LiveSession.tsx` renders two new views driven by the native state: `InactivityCountdown` (mockup 1) and `EmergencyAlarm` (mockup 2).
- `InactivityCountdown`: ring with remaining seconds, "Emergency check", "Are you okay?", the 45-second line, the contact notice with the contact's name, and a full-width "I'm okay" button. Footer: "Also cancels automatically if movement is detected."
- `EmergencyAlarm`: bell icon, "Alarm active" with "· maximum volume" appended only on Android, where the native layer confirms the alarm stream was raised. iPhone shows "Alarm active" alone. Then "Emergency detected", the recorded time and exercise, the "Alert sent to" card with status from the backend, and "Hold to stop alarm" (3-second hold).
- Hold-to-stop requires continuous press for 3 seconds. Releasing early resets the timer. Keyboard users get a 3-second activation via Enter/Space held down, announced with `aria-live`.
- Status text uses backend truth: "Delivered" only when the backend returns `delivered`; "Not delivered" when `failed` (with the error reason); "Sending…" while pending.

### Backend (`backend/`)

- `CreateAlertDto`: accept `eventType: 'manual' | 'inactivity'` and optional `location: { lat, lng, accuracyMeters, capturedAt }`, with bounds validation (`lat` ∈ [-90, 90], `lng` ∈ [-180, 180], `accuracyMeters` ∈ [0, 10000]).
- `AlertEvent` schema: add `eventType` values `inactivity` and `cancelled`; add optional `location` subdocument, optional `workoutSessionId`, optional `resolvedAt`, and `flagged: boolean` (default false). The alert record is where the workout's emergency flag lives. `status` gains `cancelled`, used only for `cancelled` events. `pending`, `delivered`, and `failed` apply to `manual` and `inactivity` events.
- `SafetyService.send`: include `location` and `workoutSessionId` in the provider payload. The payload `to` remains the contact's phone. Location is never written to application logs. It is stored on the alert record, so it is personal data (see Open risks).
- New admin endpoint `GET /admin/alerts?days=30&status=` returning recent alert events with user display name, event type, status, error code, and time. Protected by `JwtAuthGuard` + `RolesGuard` + `@Roles('admin')`, same pattern as `AdminAnalyticsController`.
- Admin list excludes precise location; it returns only whether location was shared.
- `WorkoutSession`: no schema change. The alert links to the active session via `workoutSessionId`.
- Resolution: `POST /safety/alerts/:id/resolve` sets `resolvedAt` when the lifter completes the 3-second hold. Only the alert's owner can resolve it.

### Admin screen (`frontend/`)

- New view in Me › Admin tools: "Emergency alert log", "Admin view" label, rows with time, exercise, event type, and status badge. Matches mockup 2's log.
- Badge meanings:
  - "Open": an `inactivity` alert reached `ALARM` and has no `resolvedAt`.
  - "Resolved": an `inactivity` alert with `resolvedAt` set.
  - "False alarm": a `cancelled` event, recorded when the lifter pressed "I'm okay" or movement ended the countdown. No provider call is made.
- Cancelled countdowns therefore do create records, with `eventType: 'cancelled'`, so the admin log can show false alarms. The provider is never called for them.

## Data flow

1. Lifter starts a workout. The session screen confirms camera access and that detection runs only while the screen is on (iPhone) or on a foreground service (Android).
2. No movement for 45 s → native posts `countdown-started` → web shows mockup 1 with 30 s.
3. "I'm okay" or movement → native posts `cancelled` → backend records a cancelled event (no contact) → web returns to the session.
4. Countdown reaches 0 → native starts the alarm, captures location, posts `alarm` with an idempotency key → backend `POST /safety/alerts` with `eventType: 'inactivity'`, location, and workout id → provider → status returned.
5. Web shows mockup 2 with the real status. Hold 3 s → native stops the alarm → web calls `POST /safety/alerts/:id/resolve` → alert gets `resolvedAt` and `flagged: true` → web shows "Session ended and flagged" and the existing `complete` endpoint ends the workout.

## Error handling

- Provider not configured: alert saved as `failed` with `PROVIDER_NOT_CONFIGURED`. Screen says "Not delivered: alert provider is not configured." The alarm still sounds.
- Location unavailable: alert sent without location; screen says "Location unavailable."
- Camera permission denied: session shows "Movement detection is off. Enable camera access to use the inactivity check." No countdown is ever started.
- Network loss during alert: native retries with the same idempotency key up to 3 times over 60 s; backend deduplicates on `(userId, idempotencyKey)`.
- Idempotency keys follow the existing `^[A-Za-z0-9._:-]{12,100}$` rule.

## Testing

- Backend unit: DTO validation (valid/invalid location, unknown event types), `SafetyService` payload contents including location, dedupe, `cancelled` events do not call the provider, admin endpoint rejects non-admin with 403.
- Frontend: Node tests asserting the two views exist, the 30 s and 45 s constants, the 3-second hold constant, and that "Delivered" is shown only for backend `delivered`.
- Native: unit tests on the state machine with a fake clock and synthetic frames (movement, stillness, cancel during countdown, alarm trigger at exactly 0 s).
- Device (manual, not verified by the agent): Android alarm plays with screen off; iPhone alarm plays only with screen on; permission prompts; location capture; foreground service notification.

## Out of scope

- Movement detection on iPhone with the screen locked (platform limit).
- Forced maximum device volume on iPhone.
- Calls to emergency services. The alert goes only to the configured contact.
- Choosing alert providers or setting their credentials.
- Pose or form analysis.

## Open risks

- The camera method needs good light and a clear view of the lifter. A dim gym or a phone pointed at the wrong area can cause false alarms or missed emergencies.
- Storing alert logs with names and locations is personal data. The admin view shows only whether location was shared, but the stored coordinates still exist in the database. A retention period and a deletion path must be decided before launch.
- Android background location needs the foreground-service location type and a Play Console declaration. Without it, location may be missing when the screen is off.
