# Inactivity Emergency Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During a live workout in the Expo Go app, detect that the phone has stopped moving, run a 30-second "Are you okay?" countdown, then sound an alarm and alert the emergency contact with location, and hold the emergency screen until the lifter holds stop for 3 seconds. Includes an admin alert log.

**Architecture:** Pure state machine in `mobile/inactivity/` driven by an accelerometer in the Expo host app (`mobile/App.tsx`). The host sends events to the Next.js WebView through `injectJavaScript`, and the WebView sends commands back through `postMessage`. The backend extends the existing `safety/alerts` module with event types, location, resolve, and an admin list.

**Tech Stack:** NestJS 12 + Mongoose 9 + class-validator (backend, vitest); Next.js 16 + React 19 (frontend, `node --test`); Expo SDK 57 host app with `expo-sensors@57.0.3`, `expo-keep-awake@57.0.2`, `expo-location@57.0.20` (mobile, `node --test`).

**Spec:** `docs/superpowers/specs/2026-10-12-inactivity-emergency-design.md`

## Global Constraints

- Runtime is Expo Go only: no native code, no `expo prebuild`, no foreground service, no background location.
- Expo SDK 57 package versions: `expo-sensors@57.0.3`, `expo-keep-awake@57.0.2`, `expo-location@57.0.20`. Install with `npx expo install` inside `mobile/` so the SDK pin is respected.
- Countdown length: 30 seconds. Hold-to-stop: 3000 ms continuous.
- Inactivity threshold: the saved `threshold` setting (30, 45, or 60 seconds; default 45).
- Movement: acceleration magnitude changes by more than 0.08 g between consecutive samples. Samples are read at 10 Hz.
- Location capture timeout: 5 seconds. If it fails, the alert is sent without location.
- Idempotency keys match `^[A-Za-z0-9._:-]{12,100}$`.
- Location is never written to application logs.
- No device volume changes on any platform. The "Maximum alarm volume" setting is relabeled "Alarm volume (best effort)" and changes no device volume.
- Admin alert responses never include coordinates; they return only `locationShared: boolean`.
- Icons come from `frontend/sections/Home/icons.tsx`. Only system fonts. Colors use existing CSS tokens except the mockup colors listed in the spec.

## Review Focus

These are the inputs and conditions most likely to bite a real lifter, and the spec does not spell them out:

1. A phone that is set down or dropped, which produces a large spike and resets the countdown rather than raising an alarm. Test: a single spike after stillness resets the inactivity timer.
2. Location permission denied or a fix that never arrives. Test: alarm still fires with `location: null` after the 5-second timeout.
3. Alert request fails while offline. Test: the same idempotency key is retried up to 3 times and the backend dedupes it.
4. A user who ends the workout during countdown. Test: the countdown stops, a `cancelled` event is recorded, and no provider call is made.
5. A user with no emergency contact saved. Test: an alarm is recorded as `failed` with `CONTACT_NOT_CONFIGURED`, and the alarm still sounds.

Each line above has its test in the task that owns the code, marked "Review Focus" in that task.

---

## File Structure

Backend:
- Modify `backend/src/safety/schemas/alert-event.schema.ts`: event types, status, location, workout id, resolvedAt, flagged, and an exercise snapshot.
- Modify `backend/src/safety/dto/create-alert.dto.ts`: accepts the new event types, optional location, and workout id.
- Modify `backend/src/safety/safety.service.ts`: cancelled events skip the provider, location and workout id go in the payload, and a new `resolve` method.
- Modify `backend/src/safety/safety.controller.ts`: add `POST /safety/alerts/:id/resolve`.
- Create `backend/src/admin/admin-alerts.service.ts` and `backend/src/admin/admin-alerts.controller.ts`: admin list.
- Modify `backend/src/admin/admin.module.ts`: register the new controller and service.
- Create `backend/test/inactivity-alerts.spec.ts`: backend unit tests.

Mobile:
- Create `mobile/inactivity/inactivityMachine.mjs`: pure state machine.
- Create `mobile/inactivity/movement.mjs`: movement detector over accelerometer samples.
- Create `mobile/inactivity/inactivity.test.mjs`: tests for both.
- Modify `mobile/App.tsx`: accelerometer subscription, keep-awake, location capture, bridge messages.
- Modify `mobile/package.json`: add `expo-sensors`, `expo-keep-awake`, `expo-location`, and a `test` script.

Frontend:
- Create `frontend/lib/inactivityConstants.mjs`: constants and pure text and badge helpers.
- Create `frontend/tests/inactivity-constants.test.mjs`: tests for the helpers.
- Create `frontend/sections/Coach/InactivityViews.tsx`: countdown and alarm views.
- Modify `frontend/sections/Coach/LiveSession.tsx`: wire the views to native events.
- Modify `frontend/sections/Coach/CoachSection.tsx`: pass the workout id and sessions' contact into `LiveSession`.
- Modify `frontend/lib/api.ts`: new alert, resolve, and admin alert methods.
- Modify `frontend/sections/Me Section/MeSection.tsx`: relabel alarm volume, add the admin alert log entry.
- Create `frontend/sections/Me Section/EmergencyAlertLog.tsx`: admin log view.

---

### Task 1: Alert schema and create DTO

**Files:**
- Modify: `backend/src/safety/schemas/alert-event.schema.ts`
- Modify: `backend/src/safety/dto/create-alert.dto.ts`
- Test: `backend/test/inactivity-alerts.spec.ts`

**Interfaces:**
- Consumes: none
- Produces: `AlertEvent` with fields `eventType: 'manual' | 'inactivity' | 'cancelled'`, `status: 'pending' | 'delivered' | 'failed' | 'cancelled'`, `location?: { lat: number; lng: number; accuracyMeters: number; capturedAt: Date }`, `workoutSessionId?: Types.ObjectId`, `exerciseId?: string`, `resolvedAt?: Date`, `flagged: boolean`. `CreateAlertDto` with `idempotencyKey: string`, `eventType: 'manual' | 'inactivity' | 'cancelled'`, `location?: AlertLocationDto`, `workoutSessionId?: string`, `exerciseId?: string`.

- [ ] **Step 1: Write the failing DTO test**

Create `backend/test/inactivity-alerts.spec.ts`:

```ts
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAlertDto } from '../src/safety/dto/create-alert.dto.js';

const base = { idempotencyKey: 'safe-test-123456' };
const check = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateAlertDto, body), { whitelist: true, forbidNonWhitelisted: true });

describe('CreateAlertDto', () => {
  it('accepts an inactivity alert with location and workout id', () => {
    const errors = check({
      ...base,
      eventType: 'inactivity',
      location: { lat: 14.6, lng: 121.0, accuracyMeters: 12, capturedAt: '2026-10-12T10:00:00.000Z' },
      workoutSessionId: '507f1f77bcf86cd799439011',
      exerciseId: 'exercise-1',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a cancelled event without location', () => {
    expect(check({ ...base, eventType: 'cancelled' })).toHaveLength(0);
  });

  it('rejects latitude outside [-90, 90]', () => {
    const errors = check({ ...base, eventType: 'inactivity', location: { lat: 91, lng: 0, accuracyMeters: 5, capturedAt: '2026-10-12T10:00:00.000Z' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects longitude outside [-180, 180]', () => {
    const errors = check({ ...base, eventType: 'inactivity', location: { lat: 0, lng: -181, accuracyMeters: 5, capturedAt: '2026-10-12T10:00:00.000Z' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects accuracy outside [0, 10000]', () => {
    const errors = check({ ...base, eventType: 'inactivity', location: { lat: 0, lng: 0, accuracyMeters: 10001, capturedAt: '2026-10-12T10:00:00.000Z' } });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unknown event type', () => {
    expect(check({ ...base, eventType: 'panic' }).length).toBeGreaterThan(0);
  });

  it('rejects a malformed workout id', () => {
    expect(check({ ...base, eventType: 'inactivity', workoutSessionId: 'not-an-id' }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run test/inactivity-alerts.spec.ts`
Expected: FAIL. `inactivity` is rejected by the current `@IsIn(['manual'])` rule.

- [ ] **Step 3: Replace the DTO**

Replace `backend/src/safety/dto/create-alert.dto.ts` with:

```ts
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class AlertLocationDto {
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsNumber() @Min(0) @Max(10000) accuracyMeters: number;
  @IsDateString({ strict: true, strictSeparator: true }) capturedAt: string;
}

export class CreateAlertDto {
  @Matches(/^[A-Za-z0-9._:-]{12,100}$/) idempotencyKey: string;
  @IsIn(['manual', 'inactivity', 'cancelled']) eventType: 'manual' | 'inactivity' | 'cancelled';
  @IsOptional() @ValidateNested() @Type(() => AlertLocationDto) location?: AlertLocationDto;
  @IsOptional() @Matches(/^[a-f\d]{24}$/i) workoutSessionId?: string;
  @IsOptional() @MaxLength(80) exerciseId?: string;
}
```

- [ ] **Step 4: Replace the schema**

Replace `backend/src/safety/schemas/alert-event.schema.ts` with:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export type AlertEventType = 'manual' | 'inactivity' | 'cancelled';
export type AlertStatus = 'pending' | 'delivered' | 'failed' | 'cancelled';

@Schema({ _id: false })
export class AlertLocation {
  @Prop({ required: true }) lat: number;
  @Prop({ required: true }) lng: number;
  @Prop({ required: true }) accuracyMeters: number;
  @Prop({ required: true }) capturedAt: Date;
}
export const AlertLocationSchema = SchemaFactory.createForClass(AlertLocation);

@Schema({ timestamps: true, collection: 'safety_alert_events' })
export class AlertEvent {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ required: true }) idempotencyKey: string;
  @Prop({ enum: ['manual', 'inactivity', 'cancelled'], required: true }) eventType: AlertEventType;
  @Prop({ enum: ['pending', 'delivered', 'failed', 'cancelled'], required: true }) status: AlertStatus;
  @Prop() errorCode?: string;
  @Prop() providerReference?: string;
  @Prop() occurredAt: Date;
  @Prop({ type: AlertLocationSchema, default: undefined }) location?: AlertLocation;
  @Prop({ type: MongooseSchema.Types.ObjectId, default: undefined }) workoutSessionId?: Types.ObjectId;
  @Prop() exerciseId?: string;
  @Prop({ type: Date, default: undefined }) resolvedAt?: Date;
  @Prop({ default: false }) flagged: boolean;
}
export const AlertEventSchema = SchemaFactory.createForClass(AlertEvent);
AlertEventSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
AlertEventSchema.index({ userId: 1, createdAt: -1 });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx vitest run test/inactivity-alerts.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the existing safety test to confirm no regression**

Run: `cd backend && npx vitest run test/safety-alerts.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/safety/schemas/alert-event.schema.ts backend/src/safety/dto/create-alert.dto.ts backend/test/inactivity-alerts.spec.ts
git commit -m "feat: extend alert schema and DTO for inactivity events"
```

---

**Next tasks (to be appended in the next pass):** Task 2 SafetyService send rules and resolve; Task 3 safety controller resolve route; Task 4 admin alert list; Task 5 mobile state machine; Task 6 mobile movement detector; Task 7 host app integration; Task 8 frontend constants and helpers; Task 9 frontend views and LiveSession wiring; Task 10 API client and admin log; Task 11 final verification.
