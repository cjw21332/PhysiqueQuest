# Roadmap: PhysiqueQuest

## Overview

This focused brownfield milestone delivers Camera Readiness: honest, on-device camera setup feedback with approximate framing guidance and an always-available manual workout path. Existing workouts, nutrition, profiles, progress, quests, rep-tracking assets and API persistence are the baseline. Browser/native software is implemented and regression-tested. Plan 01-03 remains at its blocking actual-device calibration checkpoint; Phase 1 is incomplete.

## Phases

- [ ] **Phase 1: Camera Readiness** - Users can assess camera setup locally, understand uncertainty and continue workouts with or without the camera.

## Phase Details

### Phase 1: Camera Readiness

**Goal**: Users can set up their camera using truthful, stable local feedback about connection, visible body, scene lighting and approximate framing while retaining manual workout continuation.
**Depends on**: Nothing (first focused phase; existing application is the brownfield baseline)
**Requirements**: READY-01, READY-02, READY-03, READY-04, READY-05, READY-06, READY-07, READY-08, READY-09, READY-10, READY-11, READY-12
**Success Criteria** (what must be TRUE):

1. User can distinguish a connected camera delivering fresh frames from body detection, and sees separate full-body, scene-brightness and approximate framing feedback that matches the visible preview across crop, orientation and mirroring. Missing or ambiguous evidence stays unknown; a missing body never produces a move-closer claim, and feedback makes no meter, lux or guaranteed subject-lighting claims.
2. User sees stable ready/adjust/unknown results that expire when evidence becomes stale. Camera switching/off, geometry changes, background/blur, screen exit, failures and thermal pauses clear old results; returning requires fresh observations, and delayed or malformed results cannot restore an obsolete pass.
3. User can use local readiness on supported browsers and native development builds without sending camera frames to a service, storing readiness media or adding readiness credentials/database records. Existing workout persistence, rep tracking and uploaded analysis remain compatible, with obsolete camera/model resources released and inference kept bounded.
4. User can understand actionable per-check status in the existing camera-check layout through text and accessible announcements/labels, with system text scaling, controls of at least 48px/dp and meaning beyond color. Permission denial, model/camera failure and unsupported runtimes explain uncertainty and permit camera-off/manual continuation.
5. A reviewer can reproduce automated evidence for geometry, invalid inputs, freshness/lifecycle races, browser/native fallback, no readiness upload and workout/provider regressions, and inspect recorded physical-device outcomes for front/back cameras, crop/orientation, lighting, body/occlusion diversity, lifecycle and performance. Thresholds are calibrated against that evidence or affected checks remain unavailable; untested hardware is explicitly identified.

**Plans**: 2/3 plans executed

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Local browser readiness, lifecycle and accessible manual fallback (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Native adapter and validated session-scoped bridge (wave 2; depends on 01-01)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-03-PLAN.md — Regression evidence and physical-device calibration checkpoint (wave 3; depends on 01-02)

**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Camera Readiness | 2/3; final plan 1/2 tasks | Human verification needed | - |

## Coverage

All 12 v1 requirements are assigned exactly once to Phase 1. No orphaned or duplicated phase assignments. Every requirement remains pending until implementation and verification.
