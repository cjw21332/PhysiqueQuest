# PhysiqueQuest functionality and optimization audit

> Latest implementation and verification: [October 18 remediation results](REMEDIATION_2026-10-18.md). Earlier audit findings below describe the baseline and are superseded where explicitly closed in that report.

Date: October 18, 2026 (Asia/Taipei). Branch: PhysiqueQuest-v2.7.4.

## Result

All existing automated suites passed after the changes below, including a fresh Android JavaScript/Hermes export. This is evidence for the checked paths, not certification that every feature works on a physical Android device or against every live provider. Tests using API/database/provider doubles are distinguished from the database-backed startup smoke test.

## Final verification

| Check | Result | Evidence / limit |
|---|---|---|
| Backend Vitest | **350 passed, 45 files** | Service, validation, controller, contract, ownership, recovery, safety, provider-failure and scoring tests; most use controlled doubles. |
| Frontend + mobile Node suites | **125 passed** | UI structure, state isolation, counters, routing, mobile address resolution and startup entry checks. |
| Full Chrome browser suite | **40 passed** | All 11 browser spec files, against a production frontend on a temporary test port. APIs mocked; includes real local model/runtime checks with untrackable synthetic clips. |
| Main application end-to-end startup | **1 passed** | Full AppModule initialized with the configured database and returned the root health response. No user workflow/data write was exercised by this smoke test. |
| Frontend production build | **Passed** | Next.js compilation, TypeScript, and page generation. |
| Backend production build | **Passed** | NestJS build. |
| Mobile TypeScript | **Passed** | Root TypeScript with `--noEmit -p mobile/tsconfig.json`. |
| Frontend lint | **Passed, no warnings** | Replaced the removed `next lint` command with an installed development-only Oxlint tool. Covers app, components, hooks, library, sections, workers, and tests. |
| Backend lint | **Passed, no warnings** | Cleared unused declarations and duplicate fixture key. |
| Android export | **Passed** | Hermes bundle generated from mobile/index.ts, 1398 modules. This is not a signed APK/AAB or a native Gradle/device test. |
| Dependency audits | **Findings remain** | Root/mobile/frontend: 17 high + 7 moderate package entries; backend: 1 high + 3 low. Parent/transitive entries can share underlying advisories. See the dedicated audit. |

The first sandboxed database startup attempt timed out. The network-enabled retry passed, and the post-change startup test passed again. The first Android export was blocked by sandbox execution permissions on the installed Hermes compiler; the permitted retry exported successfully. These were environment restrictions rather than confirmed application regressions.

## Changes made

### Smaller leaderboard database reads

Previously, scoring retrieved full embedded meal records, water records, and all settings values. The scoring code needs only user IDs, meal dates, water dates/counts, and the leaderboard-visibility preference.

The revised queries:

- Project nutrition down to `userId`, `meals.date`, `water.date`, and `water.glasses`.
- Filter settings to users with `values.showLeaderboard: false`, selecting just the relevant preference and user ID.
- Deduplicate account IDs before the display-name lookup.
- Start independent score, privacy, and rank-history reads concurrently instead of serially.

This reduces unnecessary database-to-application payload and removes avoidable sequential wait time. It does not add a persistent cache, change point values, change ranking/visibility rules, or introduce a new database schema. It still reads relevant nutrition histories, so an indexed daily-credit summary remains a possible future optimization if measured traffic warrants it. No production latency or memory reduction percentage is claimed.

Two new regression tests verify that minimal projected data produces the expected points/privacy/rank, that duplicate display-name IDs are removed, and that privacy/history reads begin while scoring is pending. Existing leaderboard tests and the entire backend suite also pass.

### Reliable frontend verification

The installed Next.js documentation confirms that `next lint` was removed. Frontend `npm run lint` now invokes its own pinned Oxlint development dependency, with the root lockfile updated. Added discoverable frontend scripts for Node tests, browser tests, and type checking.

Unused imports/parameters and redundant object-spread fallbacks were cleaned up. Public component props and hook calling signatures remain compatible. Exercise instruction-prefix cleanup retains the same accepted punctuation. The duplicate Coach test fixture key was removed while retaining its final value.

## Feature-by-feature coverage

| Feature | Checked | Remaining evidence needed |
|---|---|---|
| Registration, login, roles and sign-in events | Backend authentication/event logic and protected-route checks; browser user/admin library separation. | Real two-account sign-in/onboarding on the intended deployment. |
| Password recovery | Code issue, verification/confirmation behavior, unavailable-provider response, and email-provider unit paths. | Actual receipt/one-time use; recovery hardening below. |
| Calibration/profile/preferences | Profile validation, canonical weekdays, editors, save/error behavior, units and account-isolation checks. | Device keyboard/input and saved profile read-back on staging. |
| Home, goals, progress, quests | API-backed state, derived workout credit, dates, targets, navigation and no duplicate activity writes. | Long-lived production accounts and real measurement/history read-back. |
| Nutrition, meals and water | Validation, ownership, scan contracts, targets shared between screens, and failed/empty states. | Representative food photos through configured live providers. |
| Coach programs | Saved program reuse, context versioning, equipment/schedule filtering, and prescription presentation. | Current provider availability and deployed catalog throughput. |
| Exercise library | User/admin access boundaries, search/filter/paging, details, GIF failures/retry, and phone/desktop layout. | Real external media playback on Android/WebView. |
| Sessions and sets | Start set, Done set, pause/continue, reload recovery, skipping, editing, load/time input, retries, remaining sets, completion and report. | Simultaneous real devices and real database persistence/races. |
| Daily history and recording application | Date/week/program isolation, positive rep requirement, explicit exercise match, one-set credit, retry/provenance behavior. | Fresh staging records across timezones and concurrent apply attempts. |
| Local exercise-video counting | Supported squat/curl/push-up suggestions, full-cycle counts, unknown clips, corrections, cancellation, decode failures and attachment. | Representative human clips, codecs, camera angles, accuracy, heat/battery. Synthetic test clips do not establish exercise-recognition accuracy. |
| Safety countdown/alarm | Paused/disabled monitoring, cancellation, resolution, hold-to-stop, statuses and mocked delivery. | Physical accelerometer, permissions, sound, background/lock behavior and controlled emergency-contact delivery. |
| Admin tools | Role enforcement, exercise create/list, alerts, analytics service calculations. | UI feature completion and real analytics deployment; see below. |
| Android shell | URL resolution, Expo entry/launch rules, type checking and Hermes export. | Signed release APK/AAB, native module inclusion, installation and physical-device test. |

## Confirmed outstanding gaps

These existed before this audit and should not be hidden by passing tests:

1. **Password-reset security:** verification/confirmation uses a globally searched six-digit code, without request/account binding or a verification-attempt limit. Reset does not revoke existing JWT sessions, and code-hash collision handling remains a separate issue. Resolving these together needs coordinated API, schema, client and security tests; a partial contract change was not mixed into the low-risk optimization.
2. **Dependency advisories:** audit findings remain in the Expo/tooling tree and the separate backend tree. No forced dependency updates or Expo/React Native major upgrades were applied. See [dependency audit](DEPENDENCY_AUDIT_2026-10-18.md).
3. **Production Android hosting/configuration:** the current app configuration has LAN fallback addresses. Public HTTPS endpoints, signed release configuration and deployment are still needed, as documented in the [Android network layout](NETWORK_LAYOUT.md).
4. **Live provider/device verification:** no real food-analysis request, reset email or safety-contact notification was sent during this audit. A database-backed root smoke test does not validate complete persisted user journeys.
5. **Existing incomplete product actions:** report sharing is still an unavailable action, admin analytics has a preview path, and the administrator exercise UI does not expose every edit/delete operation available on the backend. The current checks verify the implemented behavior, not completion of these features.
6. **Remote form analysis:** the optional provider and local video counter are distinct. Local repetition tests do not validate an end-to-end stored form-score/report pipeline.

## Running the checks again

From the repository root:

```powershell
npm test --workspace frontend
node --test mobile/*.test.mjs
npm run lint --workspace frontend
npm run typecheck --workspace frontend
npm run build
npm --prefix backend test
npm --prefix backend run lint
npm --prefix backend run build
node node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json
```

From frontend, with a separately started production server on port 3221:

```powershell
$env:PQ_TRACKING_EXTERNAL_SERVER='1'
npm run test:browser
```

The application startup smoke test requires a reachable configured database/JWT environment; its command is `npm --prefix backend run test:e2e -- --hookTimeout 45000`. Android export was run from mobile with the installed Expo CLI and an ignored `dist-audit-android` output directory. Provider credentials were not printed in this audit report.

Detailed local execution logs are under ignored `artifacts/audit-*` files. Automated tests also regenerate their normal screenshots/build metadata. No Git commit, push, app publication, user-record migration, or real user test data creation was performed for this audit. Database startup may initialize declared indexes through the application's normal model initialization.
