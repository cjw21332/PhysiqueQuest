# Progress Report 13 — PhysiqueQuest v2.1.1

**Date:** October 3, 2026
**Branch:** `PhysiqueQuest-v2.1.1` (new; branched from `PhysiqueQuest-v2.1.0` @ `f3b3294`)
**Status:** Me section fully database-backed; backend partial-update bug fixed; daily-mission visual state corrected

This report covers all system changes since Progress Report 12 (`PROGRESS-12.md`).

---

## 1. Backend + database integration on the Me (Account & settings) page

**Goal:** make the Me page read *and* write to the database dynamically, with no mock data.

### Read path (already wired, verified)
- `(app)/me/page.tsx` uses the `useCurrentProfile` hook, which calls `api.getProfile()` → JWT-guarded `GET /api/profile` (NestJS `ProfileController.findOne` → `ProfileService.findByUserId` → MongoDB `profiles` collection).
- The hook has **no mock fallback**: if the backend/DB is unreachable it renders `ProfileLoadState` with an error and a "Try again" button. It never injects fake profile data.
- The returned document is cached to `localStorage[physiquequest-profile]` and broadcast via a `physiquequest-profile-updated` DOM event so other screens refresh without a reload.

### Write path (new)
- `MeSection.tsx` gained a `saveProfile(patch, featureName)` helper that calls `api.updateProfile(patch)` → JWT-guarded `PUT /api/profile` (`ProfileService.update` → `findOneAndUpdate` with `$set`).
- On success it merges the response into the cached profile, refreshes `localStorage[physiquequest-profile]`, dispatches the same update event, and shows a toast.
- Every previously-"coming soon" row now triggers a real save: **Edit** (name), **Personal data** (age/height/weight), **Goals** (goal/targetWeight/targetDate), **Training preference** (equipment/days/duration), **Health profile** (conditions/healthNotes), **Emergency contact** (contactName/contactPhone).
- The toast text is feature-specific: `${featureName} (Coming soon)` (e.g. "Personal data edit (Coming soon)") — the save still happens in the background; only the inline-editing UI is pending.
- Errors surface via `saveError` instead of silently failing.

### Removed all mock data
Every displayed value now derives from the DB profile; hardcoded fallbacks were deleted:

| Before (mock) | After (from DB) |
|---|---|
| `Level 7 · member since Aug 2026` | `member since {MMM YYYY}` from `profile.createdAt` |
| `Toji Dela Cruz` | `profile.name` (`—` if empty) |
| `Age, height, weight, measurements` (static) | `Age {age} · {height} {heightUnit} · {weight} {weightUnit}` |
| `Build muscle · 74 kg by Mar 2027` | `{goal} · {targetWeight} {unit} by {targetDate}` |
| `Dumbbells` | `profile.equipment.join(', ')` |
| `4 days` | `profile.days.length` |
| `45 min` | `profile.duration` |
| `Maria Dela Cruz` | `profile.contactName · profile.contactPhone` |
| `conditionCount \|\| 1` | real count (`0` when "None of these") |

- `frontend/sections/Home/types.ts`: added `createdAt?: string` and `updatedAt?: string` to the `Profile` type so the DB's real timestamps are typed and consumed.

---

## 2. Backend fix: partial profile updates now work (was a real integration bug)

**Symptom:** partial `PUT /api/profile` requests (exactly what the Me page sends) returned `400 "Age must be between 13 and 100"`, while full-document PUTs succeeded.

**Root cause:** the global `ValidationPipe` runs with `transform: true`, so `class-transformer` instantiates `UpdateProfileDto` and sets **every** optional field to `undefined`. The old `ProfileService.update` did:

```ts
validateProfileMeasurements({ ...current.toObject(), ...updateProfileDto });
```

Spreading the instantiated DTO blanked `age`, `weight`, `height`, etc. to `undefined` over the stored values, so `Number(undefined)` → `NaN` and validation tripped. `$set: updateProfileDto` also wrote `undefined` fields.

**Fix** (`backend/src/profile/profile.service.ts`): strip `undefined` fields before merging and persisting:

```ts
const patch: Record<string, unknown> = {};
for (const [key, value] of Object.entries(updateProfileDto)) {
  if (value !== undefined) patch[key] = value;
}
validateProfileMeasurements({ ...current.toObject(), ...patch });
const profile = await this.profileModel.findOneAndUpdate(
  { userId: new Types.ObjectId(userId) },
  { $set: patch },
  { new: true, runValidators: true },
);
```

**Verified live** against the running NestJS + MongoDB Atlas backend: partial PUTs for contact-only, goal-only, goal+target, equipment/days/duration, and conditions/healthNotes all return `200` and persist, with all other fields intact.

---

## 3. Daily missions: green state only when finished

**Request:** daily missions should not have a colored background unless finished; when finished, show a check and a green background box (like the fourth mission).

**Changes** (`frontend/sections/Quests Section/QuestSection.tsx` + `frontend/app/globals.css`):
- Incomplete missions: white card, muted icon tile (`var(--soft)`), the mission's own icon (dumbbell/meal/water), progress bar + `{amount}/{total}` count.
- Finished missions: pale-green box (`#effaf0`) with a mint border, the icon tile swaps to a green check, the title turns green-dark, and the progress row is replaced by the completed state.
- The redundant floating `.mission-checkmark` circle that overlapped the star/points was **removed** from the DOM (the green check now lives in the icon tile, out of the star's way).
- Added `aria-pressed={complete}` on the mission button for screen readers.

---

## 4. Me section coming-soon toast labels

- `saveProfile` now accepts a `featureName` and toasts `${featureName} (Coming soon)` instead of a generic "Saved", per request. Personal data, Goals, Training preference, and Health profile each pass their own name.

---

## Verification (all real)

- **Backend:** `npm run build` (NestJS) succeeds; the fix is compiled into `dist/` and hot-reloaded by `nest start --watch`.
- **Frontend:** `npm run build` (Next.js) succeeds; `tsc --noEmit` is clean.
- **Live end-to-end:** register → login → create profile → partial PUTs (contact, goal, goal+target, equipment/days/duration, conditions/healthNotes) all return `200` and persist; a subsequent `GET /api/profile` confirms every field reflects the saves while untouched fields (age, weight, height, equipment) remain unchanged.
- **Routes:** `/me` returns `200`.
- **No mock data:** a source sweep confirms no `Toji Dela Cruz`, `Maria Dela Cruz`, `Build muscle`, `Level 7`, `'74 '`, `'Dumbbells'`, `|| 4`, `'45 min'`, or `Mar 2027` literals remain in `MeSection.tsx`.

## Change boundaries

- `backend/src/profile/profile.service.ts` — the only backend source change (the partial-update fix). No API-client, auth, route, persistence-key, schema, or data-contract changes.
- `frontend/sections/Me Section/MeSection.tsx`, `frontend/sections/Home/types.ts`, `frontend/sections/Quests Section/QuestSection.tsx`, `frontend/app/globals.css` — frontend changes.
- Auto-generated build artifacts (`*.tsbuildinfo`, `next-env.d.ts`) also differ but are not source.
