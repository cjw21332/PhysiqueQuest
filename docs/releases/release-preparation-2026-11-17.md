# Release preparation — 2026-11-17

Status: not ready to deploy or distribute. Existing MongoDB is read-only for this preparation. The configured URI has no explicit database name; confirm the database before running the read-only audit. Never run migration apply on existing data without a verified backup, a reviewed dry run, and stopped writers.

## Proposed providers and estimated costs

Use Cloudflare R2 Standard as the S3-compatible private object store and Resend for transactional mail, subject to account access and end-to-end validation. Neither provider is configured locally. Store credentials only in the hosting provider's secret environment, never in Git or mobile configuration.

- R2: `STORAGE_DRIVER=s3`, `S3_REGION=auto`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_BUCKET=<private-bucket>`, and scoped `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`. Configure bucket CORS for the eventual HTTPS app origin. R2 documents atomic `If-None-Match` uploads, but signed Content-Length, browser CORS, download, deletion and delayed-upload behavior must be tested against the real bucket. Historical version erasure is not verified. [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/).
- Resend: `MAIL_PROVIDER=resend`, `MAIL_FROM=<verified-sender>`, and secret `MAIL_API_KEY`. Verify the sender domain and test verification and password reset emails. [Resend pricing](https://resend.com/pricing).
- Estimate for low usage: R2 Standard $0 within 10 GB-month, 1 million class A and 10 million class B operations; Resend $0 within 3,000 emails/month and 100/day. Above R2's free tier, standard storage is $0.015/GB-month, class A $4.50/million and class B $0.36/million. Resend Pro is $20/month for 50,000 emails. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- Illustrative Render compute: frontend, backend and coach at $7/month each, and pose at $25/month (2 GB): approximately **$46/month**, plus database, OpenAI, domain, bandwidth, build overages and any paid mail/storage. Actual resource needs and plan availability must be measured. [Render compute pricing](https://render.com/articles/set-up-self-hosted-github-actions-runners-on-render). The current Compose stack is not a Render Blueprint; private pose addressing, gateway routing, health checks and final service sizing remain to be designed and verified before provisioning.

## Selective release scope

Start from the existing release commit and review a dedicated release branch containing only the runtime source, required tests, container and deployment files needed for the intended features. Resolve dependencies on currently untracked runtime files (including OpenAI services and shared modules) explicitly. Review every staged path and secret-scan the resulting tree before any push; the remote repository is public.

Exclude local `.env` files, signing stores and passwords, account credentials, build output, experiment datasets, logs, `.opencode`, `.vscode`, and unrelated reports or scripts. Review Google service configuration separately rather than assuming it is suitable for a public repository. Preserve all original uncommitted files in the current worktree.

## Release gates

### Existing Android signing evidence

`artifacts/android/PhysiqueQuest-preview.apk` is an earlier finished Android preview build for `com.physiquequest.app`. Its signing certificate SHA-256 is `4033492F76B85113DE1230D8DE59044038198A005051029F40BFAF54351B59FB`, which differs from the certificate of the local `mobile/android/app/debug.keystore`. Local saved build metadata identifies Expo project `57fa70dc-7d18-4477-a4bb-c41cf2f3ca93` and profile `preview`. This is evidence of a different signing identity, not proof that the release key is still available. Check the Expo project's existing Android credentials and compare certificate fingerprints before selecting a signing key. A different key will not update an installed APK with the same application ID; do not replace, rotate or publish a signing key without establishing the existing identity.

1. Confirm the production database name and run `node --env-file=.env scripts/audit-readonly.mjs` from `backend/`; review aggregate counts only. Rehearse migrations against isolated synthetic data, and establish backup and maintenance procedures before any production apply.
2. Resolve all backend tests, build containers, and verify the private pose integration, S3 uploads/deletion and mail against staging resources. Verify lifecycle and storage-erasure behavior; do not claim complete erasure based on local filesystem tests.
3. Choose and provision a stable HTTPS origin and verify frontend, backend and pose flows. Configure public mobile URLs only after that origin is known.
4. Reuse the existing Android release signing identity if there is one. Supply `PQ_ANDROID_KEYSTORE_PATH`, `PQ_ANDROID_KEYSTORE_PASSWORD`, `PQ_ANDROID_KEY_ALIAS`, and `PQ_ANDROID_KEY_PASSWORD` through a private environment. Never commit the keystore or credentials. Build and verify the signed APK and test on a real Android device after the deployment passes.

## Follow-up verification
Atlas shows a PhysiqueQuest database with application collections and a separate test database; the live application target has not been independently confirmed. A read-only audit of PhysiqueQuest returned replica-set with sessions, 9 examined, 0 eligible, 9 conflicting, and 0 failed; all six legacy missing-generation counts were zero. Conflicts require investigation before migration. Expo project credentials for com.physiquequest.app show SHA-256 4033492F76B85113DE1230D8DE59044038198A005051029F40BFAF54351B59FB, matching the existing preview APK. No key was changed.

## Database cleanup
At the user request, the separate PhysiqueQuest database containing nine user records was dropped. The test database remained present with three users immediately afterward. The requested move to main has not been performed; coordinate writers and establish a verified backup first. Backend build passed after cleanup.

## Database move to main
After the user confirmed all app instances stopped, test was copied to main with MongoDB database tools. All 33 collections matched by document counts, index names and document content hashes. The local backend URI now selects main; its read-only lifecycle audit reported three active records and no conflicts. The original test database remains for rollback until all deployed clients are switched and validated. Backend and frontend production builds passed; production deployment and mobile verification remain outstanding.

## Production preparation follow-up
Cloudflare R2 private media bucket was configured in the local backend environment; bucket access and a synthetic upload, read, and deletion passed. A new health-data encryption key is stored in the ignored backend environment after checking that current main profiles had no previously encrypted health fields. The profile encryption integration suite passed both tests against the local isolated MongoDB replica set. Production hosting, transactional mail, backup/recovery of the encryption key, and private pose integration remain outstanding; no deployment has been made.
