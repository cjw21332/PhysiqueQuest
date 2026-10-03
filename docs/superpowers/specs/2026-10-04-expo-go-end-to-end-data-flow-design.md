# Expo Go End-to-End Data Flow Design

## Goal

Make the PhysiqueQuest Expo Go experience fully functional across the existing
Expo WebView, Next.js frontend, NestJS API, and MongoDB Atlas database. A user
must be able to use the real authentication/profile flow from a phone and see
persisted data after reloads and restarts. Existing demo-only capabilities must
either become persisted features or be clearly represented as unavailable, not
silently presented as live data.

## Scope

### In scope

- LAN-safe frontend and API discovery for Expo Go.
- Backend startup/configuration and CORS behavior for phone requests.
- Auth token restoration, expiry handling, profile loading, creation, and edits.
- Persistent nutrition logs, water intake, quests/progress, notifications,
  workout/coach state, and user settings using the existing app surfaces.
- Replacement of sample data in those flows with API-backed data.
- Explicit unavailable states for camera/AI operations that have no real service.
- Backend, frontend, and Expo verification for the complete mobile flow.

### Out of scope

- Replacing the WebView wrapper with a separate native UI.
- Production AI/computer-vision implementation.
- Production deployment, hosting, or changing MongoDB providers.
- Cosmetic redesign unrelated to data flow or mobile usability.

## Architecture

The Expo app remains a thin WebView wrapper. It loads the Next.js app from the
computer's LAN address. The Next.js app derives the API origin from the page
origin, so both use the same LAN hostname:

```text
Expo Go -> http://LAN_HOST:3000 (Next.js)
Next.js -> http://LAN_HOST:4000/api (NestJS)
NestJS -> MongoDB Atlas
```

The API client will expose a small, typed resource layer. Authenticated
requests attach the JWT from storage, normalize network/API errors, and clear
invalid auth state on a 401. Pages and feature sections will consume resource
hooks rather than seed their initial state from sample constants.

## Data resources

The backend will add user-owned resources with ownership enforced by the JWT:

- `nutrition`: meals, water logs, and history entries.
- `workouts`: plans, workout sessions, exercise completion, and progress.
- `quests`: quest definitions, user progress, XP, and milestones.
- `notifications`: notification records and read state.
- `settings`: persisted app preferences and emergency/contact settings.

Each resource gets a schema/model, DTO validation, service, controller, and
tests. Responses will use stable JSON shapes suitable for the existing UI.
Create/update operations will return the saved record so the client can update
optimistically without inventing a second local representation.

## Mobile behavior

- Expo Go will show a connection/configuration state when the web app cannot be
  reached, including the active URL and a manual LAN URL field.
- The web app will show a backend-unavailable state when API requests fail,
  including retry and sign-out actions where appropriate.
- Launch navigation will remain WebView-safe through normal document links.
- Camera/AI features will not display fabricated successful results. They will
  show the actual capability status and preserve manual workout/logging paths.

## Error and persistence rules

- Server data is authoritative after authentication.
- Local storage is limited to auth/session recovery and transient UI state; it
  is not used as a silent substitute for missing server data.
- Empty server collections render an intentional empty state, never sample
  records.
- A missing profile routes the user to calibration/profile setup.
- A 401 clears the token and routes to launch; other failures remain visible
  with retry controls.
- Backend validation errors are shown at the relevant form or action.

## Verification gates

1. Backend unit/e2e tests cover auth, ownership, validation, and each resource.
2. Frontend tests cover API URL derivation, auth recovery, empty/error states,
   and removal of sample-data initialization from live screens.
3. Frontend production build and mobile TypeScript/bundle checks pass.
4. Manual/UAT flow passes against a running MongoDB-backed API:
   launch -> register -> calibration -> persisted home -> add/edit data ->
   reload Expo Go -> data remains -> logout -> login restores data.

## Delivery sequence

1. Stabilize API configuration, auth, and profile loading.
2. Add shared backend resource patterns and migrate nutrition/settings.
3. Migrate quests/progress/notifications/workouts.
4. Add explicit camera/AI capability states.
5. Run the full verification flow and document exact startup commands.
