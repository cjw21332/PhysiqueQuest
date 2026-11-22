# Release 1.2.0 dossier — BLOCKED

Date: 2026-11-22 (Asia/Singapore). This is an incomplete release gate, not an approval to ship. No APK was produced, installed, or hashed and no backend was deployed in this attempt. No app data was cleared.

## Configuration and provenance

- Git branch remains `pose-tracker-work`; `git switch -c release-1.2.0` failed with `cannot lock ref ... Permission denied`. The working tree already contained uncommitted work. `git tag -l` returned no tags in this checkout; `demo-monday` was not modified or deleted. Its absence here needs investigation.
- Node v24.19.0, Android Studio JBR OpenJDK 25.0.4, Gradle 9.4.1, installed Android build-tools 36.0.0 and 37.0.0. Frontend is Next 16; mobile Expo/React Native with Android Gradle; backend NestJS with MongoDB/Mongoose, and a production Dockerfile. Backend `OPERATIONS.md` says production deployment was not established; Render URLs in configuration are candidates, not proof of an active deployment.
- `mobile/app.json` and `mobile/android/app/build.gradle` specify `1.2.0`, code `4`. Package `com.physiquequest.app`. Installed version and version-code ordering are unknown: ADB cannot connect. Release signing requires `PQ_ANDROID_KEYSTORE_PATH`, `PQ_ANDROID_KEYSTORE_PASSWORD`, `PQ_ANDROID_KEY_ALIAS`, `PQ_ANDROID_KEY_PASSWORD`, none set in this process. Certificate match is unknown. Do not install until verified.
- Expo extra specifies `https://physiquequest-api.onrender.com/api` and a `trycloudflare.com` frontend URL; the mobile-shell build script uses `https://physiquequest-coach.onrender.com/api` by default. The actual effective APK URLs and deployment compatibility have not been established. Production backend configuration requires `NODE_ENV`, `JWT_SECRET`, `MONGODB_URI`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `CORS_ALLOWED_ORIGINS`, `API_PUBLIC_URL` and appropriate `TRUST_PROXY`; see `backend/OPERATIONS.md`. Never place secrets in this dossier.

## Gate evidence

Commands run from project root unless noted. Logs contain full captured output, not merely summaries. Empty typecheck logs mean exit 0 with no output.

| Command | Result | Log |
| --- | --- | --- |
| `npx tsc --noEmit -p frontend/tsconfig.json` | PASS, exit 0 | `build-logs/frontend-typecheck.log` |
| `npx tsc --noEmit -p mobile/tsconfig.json` | PASS, exit 0 | `build-logs/mobile-typecheck.log` |
| `npm run lint --workspace frontend` | exit 0; 18 warnings | `build-logs/frontend-lint.log` |
| `npm run lint --workspace mobile` | FAIL: missing script | `build-logs/mobile-lint.log` |
| `npx oxlint mobile --format unix` | exit 0; 8 warnings | `build-logs/mobile-oxlint.log` |
| `npm --prefix backend run lint` | exit 0; 11 warnings | `build-logs/backend-lint.log` |
| `npm --prefix backend run build` | PASS, exit 0; Nest build includes TypeScript compilation | `build-logs/backend-build.log` |
| `npm run build --workspace frontend` | BLOCKED: did not complete during this attempt; interrupted with the gate runner. No production build pass claimed. | No completed output capture |
| `npx vitest run --exclude output/** frontend/tests/tracking-telemetry.spec.ts shared/__tests__/trackingTelemetryNative.spec.ts shared/__tests__/nativeTelemetrySession.spec.ts frontend/tests/generic-bitmap-ownership.spec.ts shared/__tests__/exerciseEngine.spec.ts mobile/poseStartGate.test.ts shared/__tests__/genericRepCounter.spec.ts shared/__tests__/genericRepCounter.cases.spec.ts` | PASS: 8 files, 108 tests | `build-logs/focused-vitest.log` |
| `node --test mobile/camera-readiness.test.mjs` | PASS: 27 tests | `build-logs/camera.log` |
| `npx vitest run --exclude output/**` | FAIL: 137 files failed, 122 passed, 1 skipped; 115 tests failed, 2670 passed, 1 skipped. This root run also includes backend tests in an inappropriate working directory and numerous environment errors. | `build-logs/vitest.log` |
| `npm --prefix backend run test` | FAIL: 20 files failed, 107 passed; 107 tests failed, 2522 passed. Numerous localhost `EACCES`; also `/quests/badges` coverage and chat mobility assertion fail. | `build-logs/backend-test.log` |
| `npm audit --json` | BLOCKED: `ENOTFOUND registry.npmjs.org`; vulnerability status unknown | `build-logs/npm-audit.log` |
| `npm ci --dry-run --ignore-scripts --fetch-retries=0 --fetch-timeout=5000` (root and backend) | Dry runs reported up to date. **Not a clean dependency installation**; no install/deprecation or vulnerability assessment established. Existing dependencies preserved. | terminal output only |
| `gradlew.bat assembleRelease --offline` | BLOCKED: fresh Gradle home cannot resolve `services.gradle.org`; cached Gradle direct attempt cannot connect to daemon. | `build-logs/gradle.log`, `build-logs/gradle-installed.log` |
| `adb devices -l` | BLOCKED: server cannot start/connect; loopback socket error 10013 | `build-logs/adb.log` |

## Warnings and limitations

| Warning | Source | Status | Reason / risk |
| --- | --- | --- | --- |
| 18 unused variables/imports, unnecessary escapes and fallback spreads | frontend lint log | Deferred | Existing code; low immediate risk but unused values may conceal incomplete behavior. Each location is listed in the log. |
| 11 unused variables/parameters, array construction and spread warnings | backend lint log | Deferred | Existing code; low immediate risk, unused configuration/parameters warrant review. Each location is in the log. |
| 8 unused values, array/spread warnings | mobile oxlint log | Deferred | Existing code/tests; low immediate risk, unused lifecycle variable warrants review. Each location is in the log. |
| Audit endpoint unavailable | npm audit | Deferred | DNS blocked; vulnerabilities cannot be determined. |
| Other build/test warnings | full logs | Review required | The release gate did not complete; no zero-warning claim. |

## Backend and device verification

`curl.exe -I --max-time 15 https://physiquequest-api.onrender.com/api/health` failed to resolve the hostname. A local production process was started, but requests to `/health`, `/ready`, `/api/auth/session/refresh`, and `/api/exercises` all failed with WinError 10013; no status codes, successful startup, auth, database, CORS or HTTPS verification can be claimed. The health path in operations documentation is `/health`, readiness `/ready`. Deployment credentials and actual hosting configuration were not established; no deploy was attempted.

Device details, signing certificate, update compatibility, startup, camera permission, API calls, 60-second logcat and phone performance are all unverified. No `adb install` was attempted. Neither uninstall nor data clearing was used.

## Known limitations and manual acceptance

Counting accuracy is not validated; partial reps are unassessed; plate occlusion is experimental; most of the approximately 1,500 catalog entries are mapped but untested; camera recovery and telemetry have not been verified on a phone. Existing native telemetry is unfinished. Do not equate automated simulations with device results.

Once a signed compatible build and backend pass the release gate, manually check seated fly and hip abduction, a chest press set, switching apps mid-set, front/back camera switching, and a 20-minute session. Record observations and any interruptions; ADB cannot judge counting or form-check quality.

## Changes and follow-up

This attempt added this dossier and gate logs, and updated progress. No tracker, counting threshold, test expectation, labels or rejected hold guard was edited. The existing uncommitted version and telemetry work predates this attempt. Re-run all gates after resolving environment access and actual assertion failures. Obtain the existing signing credentials privately, verify the installed APK certificate and version, then build and use only `adb install -r` if signatures match. If signatures differ or the update is incompatible, stop without uninstalling.
