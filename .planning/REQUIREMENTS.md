# Requirements: PhysiqueQuest Camera Readiness

**Defined:** 2026-10-20
**Core value:** Help users set up the camera with honest feedback while preserving manual workouts.

## v1 Requirements

### Local Evidence

- [ ] **READY-01**: Camera connection reflects fresh decoded frames, independently of whether a person is detected.
- [ ] **READY-02**: Full-body readiness requires credible head, bilateral limb and foot evidence inside the visible preview, accounting for crop, orientation and mirroring.
- [ ] **READY-03**: Lighting uses local image brightness on web and native metadata where available; missing evidence is unknown and copy describes scene brightness, not measured lux or guaranteed subject lighting.
- [ ] **READY-04**: Position feedback gives approximate move-closer/move-back/framing guidance without meter claims; absent or ambiguous bodies are not classified as too far away.

### Reliability and Integration

- [ ] **READY-05**: Ready/adjust/unknown feedback uses stable observations, bounded sampling, one inference in flight and stale-evidence expiry; invalid payloads never pass.
- [ ] **READY-06**: Camera off/switch, geometry change, background/blur, screen exit, track/model failure and thermal pause invalidate old results; reopening requires fresh observations and releases obsolete resources.
- [ ] **READY-07**: Browser and native development builds use existing local models through validated session-scoped adapters; existing rep tracking and uploaded analysis remain compatible.
- [ ] **READY-08**: Permission denial, model failure, unsupported native runtime and camera unavailability show truthful fallback and permit camera-off/manual session continuation.
- [ ] **READY-09**: Live readiness sends no camera frames to a backend/service, stores no readiness media and adds no API credentials or database records.

### UX and Validation

- [ ] **READY-10**: Existing camera-check layout presents clear per-check status and actionable uncertainty, accessible announcements/labels, text scaling and at least 48px/dp controls without color-only meaning.
- [ ] **READY-11**: Automated checks cover evaluator geometry/invalid evidence, freshness/lifecycle races, browser/native bridge fallback, no readiness upload and existing workout/provider regressions.
- [ ] **READY-12**: Real-device validation records front/back camera, crop/orientation, lighting, body/occlusion diversity, lifecycle and performance outcomes; provisional thresholds are calibrated or unresolved checks remain unavailable. Hardware not tested is explicitly reported.

## Future Requirements

Measured range, subject-region/backlight analysis, broader pose/form evaluation and native interface migration require separate scope and evidence.

## Out of Scope

No new external readiness service, frame upload/storage, blocking workout gate, new dependency, Redux, policy text, or unrelated interface redesign.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| READY-01 | Phase 1 | Pending |
| READY-02 | Phase 1 | Pending |
| READY-03 | Phase 1 | Pending |
| READY-04 | Phase 1 | Pending |
| READY-05 | Phase 1 | Pending |
| READY-06 | Phase 1 | Pending |
| READY-07 | Phase 1 | Pending |
| READY-08 | Phase 1 | Pending |
| READY-09 | Phase 1 | Pending |
| READY-10 | Phase 1 | Pending |
| READY-11 | Phase 1 | Pending |
| READY-12 | Phase 1 | Pending |

**Coverage:** 12/12 v1 requirements mapped exactly once; 0 orphaned requirements. All remain pending until implementation and verification.
