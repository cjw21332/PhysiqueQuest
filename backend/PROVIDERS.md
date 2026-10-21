# Provider setup and local verification

No production provider accounts have been configured or verified by this work.

## Mail and verification

`MAIL_PROVIDER=console` captures at most 100 messages in process memory and never prints addresses, links or codes. It is a test adapter, not deliverable mail. For an interactive local flow use `MAIL_PROVIDER=mailpit`, start Mailpit, and set `MAILPIT_URL=http://127.0.0.1:8025`; open its inbox UI on that origin. Resend/Brevo use their fixed HTTPS APIs with `MAIL_API_KEY` and `MAIL_FROM`; verify the sending domain with the provider's SPF/DKIM records before sending real mail. Existing EmailJS/password-reset transport remains compatible when MAIL_PROVIDER is unset.

New accounts carry `authPolicyVersion=2`, `emailVerified=false`, `legacyEmailAccess=false`. Existing accounts with a missing/older policy version retain grandfathered access. The user response carries these flags; the frontend shows a verification link. Verification links put the opaque credential in the fragment, remove it from browser history, and require explicit confirmation. MongoDB stores its SHA-256 hash; consumption and user verification occur in one transaction. Tokens expire after `EMAIL_VERIFICATION_TTL_MINUTES=60`; requests are neutral to unknown addresses, have a 60-second account cooldown and shared IP/account throttles.

`EMAIL_VERIFICATION_ENFORCED=false` preserves the current development rollout. Turn it on only with `MIN_APP_VERSION` and `REQUIRE_APP_VERSION=true`, after releasing the verification page. Older clients get 426 APP_UPDATE_REQUIRED. Unverified new users may authenticate, refresh/logout/manage sessions, inspect their identity, verify email and finish their own onboarding profile. Other protected features return 403 EMAIL_VERIFICATION_REQUIRED with the verification path. Grandfathered accounts keep ordinary access but must verify before password change, email change or account deletion. Completing password reset proves mailbox possession and marks email verified. No email-change endpoint currently exists.

## Push

See [PUSH.md](PUSH.md). Default `PUSH_PROVIDER=dry-run` explicitly records not-sent outcomes. Set `PUSH_PROVIDER=expo` and optional private `EXPO_ACCESS_TOKEN` when Expo project/credentials and development builds are available. Register the resulting Expo token through the authenticated device endpoint; revoke on account switches. Direct FCM/APNs is intentionally absent. Physical delivery and receipt cleanup must be tested on Android and iOS; current Expo Go Android limitations require a development build for remote push.

## Private media and R2

Default `STORAGE_DRIVER=local` uses `.data/uploads`, outside the web root. Production uses `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION=auto`, the account's HTTPS `S3_ENDPOINT`, and private `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`. MinIO uses the same adapter and `S3_FORCE_PATH_STYLE=true`. Scope this identity to the media bucket, not account administration. Configure exact frontend origins in bucket CORS and allow PUT with content-type/content-length/if-none-match. Keep bucket listing/public access disabled.

POST `/api/storage/uploads` with contentType/size receives a randomized key and a 15-minute signed upload URL. PUT exact JPEG/PNG/WebP bytes with the declared Content-Type and `If-None-Match: *` for S3. Complete the upload through its owned `/complete` endpoint; the backend validates content bytes and exact size before issuing a 60-second signed download. Pose video/camera frame persistence is rejected. Local signed URLs use path components, not query credentials.

Pending/unreferenced uploads expire after ORPHAN_UPLOAD_TTL_HOURS; analyzed nutrition originals expire after MEDIA_ORIGINAL_TTL_HOURS. Cleanup deletes objects before metadata and can resume after errors. Account purge also deletes objects first. Do not add MongoDB TTL to upload metadata: deleting references before objects would orphan bytes. Configure a bucket lifecycle safety net and test an expired upload.

Optional private CDN: deploy `deploy/private-media-worker.mjs` as a Cloudflare Worker, bind the private R2 bucket as MEDIA, and set a private canonical base64 32-byte CDN_SIGNING_KEY in both Worker and Nest. Set the Worker's final HTTPS origin as CDN_BASE_URL. Owned download responses then return HMAC-signed60-second CDN URLs bounded by the original's retention deadline. The Worker verifies signature/expiry before any R2 read; byte serving stays private with no public bucket. The local Worker test proves invalid/expired signatures cannot read storage. Cloudflare request logs must omit/redact signed query strings. Source originals are intentionally preserved for analysis; browser scanImage preprocessing already bounds image dimensions/encoding. No paid Cloudflare image-transformation service is activated. Production CDN routing and image-policy verification remain operator work.

## Sentry

Set private server `SENTRY_DSN` separately in Nest and Next. Optional `NEXT_PUBLIC_SENTRY_DSN` permits browser reporting; this DSN is a public ingestion identifier, never an auth token. Without a DSN the SDK stays disabled. Strict beforeSend allowlists drop message contents, request headers/body/cookies, user identity, health fields, breadcrumbs, attachments and arbitrary context. Only safe stack positions and a validated correlation ID remain. Tracing, replay and log collection are off.

Source map upload is opt-in: SENTRY_UPLOAD_SOURCEMAPS=true with private SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT in CI. Never put these in NEXT_PUBLIC variables. Trigger a synthetic exception in staging and inspect the event for redaction before accepting production monitoring.

## Encrypted backups and restore

Install official MongoDB Database Tools (`mongodump`, `mongorestore`) on a separate scheduled backup runner. Configure its private application-read URI, canonical base64 32-byte BACKUP_ENCRYPTION_KEY, BACKUP_S3_BUCKET and R2 credentials scoped to backups. Preserve encryption keys separately with restricted recovery access; database field-encryption keys are also required to read restored profiles.

Run `node scripts/backup.mjs create`, or `node scripts/backup.mjs schedule` with BACKUP_INTERVAL_HOURS=24. BACKUP_RETENTION_DAYS defaults to35 and cannot exceed35. The runner encrypts archives with AES-256-GCM before upload, uses a private temporary directory for MongoDB tool config, and prunes expired backups. A local encrypted adapter is available by omitting BACKUP_S3_BUCKET and setting BACKUP_LOCAL_DIR. Do not run two schedulers for the same identity. Monitor backup_created/backup_failed events and missed schedules externally.

Restore only to a new `pq_restore_test_<16 hex>` database: set RESTORE_MONGODB_URI and BACKUP_SOURCE_DATABASE, then `node scripts/backup.mjs restore backups/<recorded-object>.dump.enc`. Authentication is verified before the archive is passed to mongorestore. Check record counts, owned profile decryption, `/ready`, authentication and read-only critical flows; never promote automatically. The script deliberately has no live-database overwrite/drop option. On paid Atlas tiers, native Cloud Backup replaces this script after a verified restore exercise.

The encrypted archive roundtrip/tamper test passes. Official MongoDB Database Tools100.19.1 were downloaded into a temporary directory, and `node scripts/verify-backup.mjs` passed an actual mongodump/encrypt/restore check into a separate synthetic database, matching record count and values. Both generated databases and the temporary archive were removed. Tools are not installed system-wide. A Docker daemon and cloud backup schedule remain unverified. Deleted data can remain in encrypted backups until the35-day rolloff; deletion must be reapplied after restoring an older snapshot.

## Background nutrition analysis

Existing synchronous scan calls remain compatible. For quick-return analysis: upload and verify a nutrition photo, POST `/api/jobs/nutrition` with `{uploadId}`, then poll its owned `GET /api/jobs/nutrition/:id`. Creation returns202 and deduplicates by user/upload. The durable job payload contains user/resource IDs only; image bytes are loaded transiently by the worker. Results live in a separate owned result collection, expire with completed jobs, and are deleted with the account. Failed jobs retain only a generic error code for7 days. A crashed paid-provider call is marked interrupted rather than replayed automatically. MongoDB transactions prevent a completing analysis from recreating data after account deletion. Pose camera frames/videos remain transient and are never queued to persistent storage.

## Sync and screen aggregates

`GET /api/sync?resource=workouts|progress&since=<ISO>&limit=1..100` returns changed upserts, a page of owned live IDs and a signed nextCursor. Repeat with the same resource/since until complete. Stage the whole inventory, then reconcile removed cached IDs only when complete; never remove after an interrupted partial sync. Watermarks reread the boundary millisecond. Cursors are owner-bound and expire after one hour. `/api/sync/snapshots` replaces owned singleton data, including null for removed profiles; embedded collections are explicitly windowed to the most recent100. `/api/sync/dashboard` fetches four bounded screen resources in parallel. Existing endpoints and retry/idempotency contracts remain compatible; there is no automatic offline-write replay.
