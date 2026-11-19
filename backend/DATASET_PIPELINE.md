# PhysiqueQuest contribution pipeline (Phase 3)

Infrastructure for collecting real, consented exercise recordings and turning
them into training data. Nothing here runs on ordinary PoseTracker sessions.

## Privacy model

| Rule | Implementation |
|---|---|
| Separate consent | `dataset_consents` stores the accepted consent **text hash** and version. Camera permission or using PoseTracker is not consent. |
| Explicit per-recording opt-in | A clip is only stored by `POST /dataset/clips`; there is no background upload path. |
| Pseudonymous subjects | `subjectPseudonym = HMAC-SHA256(DATASET_PSEUDONYM_SECRET, "dataset:"+userId)[:24]`. The secret never leaves the server and is not in exports. |
| No identity in exports | `export-dataset.mjs` asserts that `userId`, `_id`, `email`, `displayName`, `passwordHash` are absent from every exported record. `ml/scripts/75_ingest_contributions.py` refuses an export that contains them. |
| No raw media | Only FEATURE_SPEC keypoint sequences are uploaded (33×4 per frame, 15 fps). No video, images, face mesh textures or audio. |
| Withdrawal | `DELETE /dataset/consent` deletes every clip and payload for the account and tombstones the consent. `DELETE /dataset/clips/:id` removes one contribution. |
| Review visibility | The admin queue projects out `userId`; reviewers see the study code only. |

A residual risk to state plainly: pose geometry is not guaranteed anonymous.
Gait and body proportions can be identifying in principle, which is why consent
is explicit and withdrawal is destructive.

## Flow

1. `GET /dataset/consent` returns the current text, version and hash plus the
   caller's state (`contributable`, or `not_accepted` / `outdated_version` /
   `withdrawn`). The client must render that text, not its own copy.
2. `POST /dataset/consent` with `{version, textHash, accepted: true}` records the
   acceptance. A stale version or hash is rejected.
3. The client records the chosen exercise with the camera, applies FEATURE_SPEC
   v1.1 normalisation (`mobile/datasetContribution.mjs`), checks quality locally,
   then `POST /dataset/clips`.
4. Server validation (`dataset-payload.ts`) recomputes quality instead of trusting
   the client: 15 fps (±), 5–120 s, 132 values per frame, finite and plausible
   coordinates, strictly increasing timestamps, **≥ 70% frames with a body**.
5. Duplicate detection by content hash (`payloadSha256`, unique index). A repeat
   upload returns `409 DATASET_DUPLICATE` and no second copy is stored.
6. Clips land in `pending_annotation`.
7. A reviewer calls `GET /dataset/admin/queue` and `PATCH
   /dataset/admin/clips/:id/annotation` with exercise identity, correctness,
   movement start/end, rep boundaries, phases, form deviations, keypoint quality
   and a decision (`accepted` / `rejected`).
8. `node scripts/export-dataset.mjs --out ../ml/data/contributions/v1 --version v1`
   writes accepted clips + `manifest.json`.
9. `ml/scripts/75_ingest_contributions.py --input <export>` converts them to npz
   and reports per-pattern subject counts, flagging patterns with <4 subjects.

## Storage

- Metadata: `dataset_clips` (indexed by status and by pseudonym).
- Payloads: `dataset_clip_payloads`, one gzipped document per clip, separate from
  metadata so the annotation queue never loads coordinate megabytes.
- No new infrastructure: uses the existing MongoDB. There is no S3 dependency for
  contributions, so no bucket policy can accidentally expose them.

## Configuration

| Variable | Meaning |
|---|---|
| `DATASET_PSEUDONYM_SECRET` | ≥16 chars, server-only HMAC key. Missing = endpoint returns `403 DATASET_NOT_CONFIGURED`. |
| `DATASET_EXPORT_LICENCE` | Licence string written into the export manifest. |

Rotating the secret changes all future study codes; existing clips keep the code
they were stored with.

## API surface

| Method | Path | Auth |
|---|---|---|
| GET | `/dataset/consent` | user |
| POST | `/dataset/consent` | user |
| DELETE | `/dataset/consent` | user |
| POST | `/dataset/clips` | user |
| GET | `/dataset/clips` | user |
| GET | `/dataset/clips/:id` | user |
| DELETE | `/dataset/clips/:id` | user |
| GET | `/dataset/admin/queue` | admin |
| PATCH | `/dataset/admin/clips/:id/annotation` | admin |

## Known gaps (not claimed as done)

1. **Mobile screen is not mounted.** `mobile/DatasetContributionScreen.tsx` is a
   presentational flow and `mobile/datasetContribution.mjs` holds the tested
   logic; the camera wiring into `NativeTrackingCamera` is not done, and nothing
   has been device-tested. Do not show this to users until it is.
2. **Live vs padded-extraction parity is unverified.** Training data is extracted
   from padded video frames; phone contributions use the live pipeline. The
   coordinate normalisation is identical, but MediaPipe sees different input
   context. Run a parity check on the same clip before mixing both sources in one
   training set.
3. No retention job yet: rejected clips stay until deleted; add a TTL policy.
4. No rate limiting specific to contributions (the global limiter applies).
