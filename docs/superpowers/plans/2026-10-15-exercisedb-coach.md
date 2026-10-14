# ExerciseDB AI Coach Implementation Plan

> Agentic workers: execute the assigned independent backend/frontend work with test-first validation; preserve existing uncommitted work.

**Goal:** Replace seeded exercise sourcing with the free ExerciseDB V1 API throughout the independent AI Coach catalog and programs, and match the supplied library/detail layouts. The user's V1/GIF request supersedes the earlier V2/video proposal.

**Architecture:** Standalone NestJS service on port 4050, with no MongoDB connection or imports from other feature modules. The existing API may host the same provider for compatibility. Library requests go directly to the Coach service. Personalized planning accepts validated profile context and uses the same ExerciseDB catalog; the existing account profile/workout APIs remain responsible for account persistence. ExerciseDB access is server-side only. Existing program logic is extracted into a reusable planner without database dependencies.

**Provider contract:** Free V1 at `https://oss.exercisedb.dev/api/v1`, no key required. `/exercises` supports `name`, `bodyParts`, `equipments`, `limit` (max 25), cursor `after`. `/exercises/search` supports `search` and `threshold`. `/exercises/:id` returns bodyParts, equipments, targetMuscles, secondaryMuscles, gifUrl and instructions. Default real-time requests, no persisted media or local catalog fallback. Live schema/calls verify a 1,500-exercise dataset, not V2's 11,000+. Attribution and non-commercial-use restriction apply.

**Frontend response contract:** `GET /api/exercises?search=&muscle=&equipment=&page=&limit=` returns `{items,total,page,limit,pages,source:'ExerciseDB V1',coverageNote?}`. Stable `_id`/`slug` are provider exerciseId; rows include name, targetMuscle (friendly body category), equipment (friendly), gifUrl, description derived from actual metadata, instructions[], checks derived from actual instructions, trackingStatus:'Manual', pose:'missing', recommended?. Detail fetch refreshes the demonstration URL. `GET /api/exercises/:id` returns the full normalized record. `POST /api/coach/plan` accepts `{profile:{goal,days,duration,equipment,conditions,createdAt?}}`, returns the existing CoachPlanRecord shape with individual prescriptions/tips. `GET /api/coach/status` reports source/availability. GIF controls start, freeze or replay animation; no invented MP4 duration or provider difficulty/AI assessments.

## Backend task

- [x] Write provider tests for keyless V1 access, encoded filters, detail/media normalization, strict search, common browsing minimum ten where available, upstream authentication/rate-limit/timeout errors, and no seeded fallback.
- [x] Implement bounded requests, fresh media and provider-only normalization; list/search never silently fabricate exercises.
- [x] Extract the current planner from database lookups, source its candidate exercises from ExerciseDB and hydrate chosen exercise details for cues.
- [x] Add standalone module/bootstrap/start scripts, validated request context, CORS, resource limits and configuration examples. It must boot without MongoDB or any other section.
- [x] Run backend suite/build and document keyless access and provider limitations.

## Frontend task

- [x] Route catalog/detail/program requests to the standalone service using configurable/LAN-safe port-4050 derivation; never expose the provider key.
- [x] Match screenshot search/chips/list and bottom detail sheet with real GIF controls, descriptions, instructions, recommendation and provider form cues. Tracking remains truthfully unavailable unless actually implemented.
- [x] Remove every frontend beta entry and tracking deep-link launch; keep backend/native capability files intact.
- [x] Make library accessible despite account-profile/plan failures; preserve honest provider errors and retries.
- [x] Add browser coverage for the real service contract, detail loading/retry, no unrelated search results, GIF playback using test-only media, and responsive/focus/close behavior.

## Integration verification

- [x] Run both builds, Node/mobile tests, backend tests and browser suite.
- [x] Boot standalone service with MongoDB absent and confirm status and real keyless catalog access from the frontend.
- [x] Verify real V1 categorized browsing, at least ten accessible matches per supported category, precise search, detail instructions and GIF animation/pause, plus a provider-sourced Coach program saved through the account API. Completed with live V1 responses and temporary-account cleanup.

**Known prerequisite:** None for V1 authentication. Live provider rate limits/availability and GIF requests must be checked before completion claims. Categories with fewer than ten matching provider entries must report the shortfall rather than fabricate records; search must remain specific and cannot be described as exhaustive if a bounded result pool is used.
