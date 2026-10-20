# PhysiqueQuest

## What This Is

A QCU capstone mobile fitness application intended to help people follow their training consistently through AI coaching, workout management, form instruction, food tracking, lifting progress, goals, and competitive quests. See ../PRODUCT.md for the confirmed product record.

## Core Value

Users can follow a workout regimen consistently and see their recorded progress toward their goals.

## Current Milestone: Camera Readiness

Initialize GSD for the existing application and plan evidence-backed, on-device camera setup checks. This milestone is deliberately limited to camera readiness; it does not re-plan the entire existing product.

## Requirements

### Validated Existing Capabilities

Source-inspected brownfield capabilities, not fresh device-validation claims:

- Existing Next.js/React interface, Expo/React Native WebView shell, NestJS APIs, MongoDB persistence.
- Camera preview and optional camera-off workout flow.
- Bundled browser MediaPipe model/worker and installed native MediaPipe camera integration.
- API-backed workouts, sets, nutrition, profiles, progress and quests.

### Active

- [ ] Fresh-frame camera connection evidence.
- [ ] Full-body visibility based on full landmarks and visible preview geometry.
- [ ] Local scene-lighting feedback with truthful limitations.
- [ ] Approximate framing guidance rather than measured camera distance.
- [ ] Stable feedback, stale-result rejection, lifecycle teardown and manual fallback.
- [ ] Automated regressions and explicit real-device calibration evidence.

### Out of Scope

- Native interface migration, new pose service, new dependencies or state library.
- Form scoring, rep-counting enablement, safety clearance or practitioner-equivalence claims.
- Camera-to-person meter measurement, new readiness API/database, media storage/upload.
- Reworking uploaded workout analysis or unrelated app features.

## Context

The camera check currently calls a configurable remote pose provider, which is not an implemented readiness engine. Browser/native pose adapters currently discard full landmarks in favor of exercise-specific rep joints. Native metadata already includes normalized image luminance. Existing APIs remain authoritative for workout persistence.

## Constraints

- Use existing hooks, models, native bridge and persistence patterns; no Redux.
- User selected on-device checks and approximate framing guidance on 2026-10-20.
- Preserve camera-off/manual workouts and existing user records.
- Unsupported, ambiguous, malformed or stale evidence must remain unknown.
- Respect system text scaling, accessible labels and 48px/dp touch controls.
- Existing policy pages are drafts; do not invent consent/policy text.
- Planning only in this run: no application edits, installation, commits or branch changes.

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| On-device readiness | User selection; reuse bundled models and avoid uploading frames | Locked for planning |
| Approximate framing | Existing pose output does not measure camera range | Locked for planning |
| Keep current architecture | Scope is readiness, not a mobile rewrite | Locked for planning |
| Require device calibration | Thresholds and camera geometry are not validated by source inspection | Pending execution evidence |

---
Last updated: 2026-10-20 — brownfield GSD initialization.
