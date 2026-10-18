# PhysiqueQuest remediation results — October 18, 2026

Branch: `PhysiqueQuest-v2.7.4`. This report supersedes the baseline gaps in the earlier functionality audit where explicitly addressed below. Changes remain local for review; this remediation has not been committed, pushed, deployed or published.

## Implemented

- **Account recovery:** request-bound HMAC code digests, five verification guesses, shared MongoDB request limits and a rolling resend cooldown. Verification issues a separate short-lived reset grant. A transaction consumes that grant, updates the password, revokes older JWT sessions and invalidates other recovery records together. Legacy code-only confirmation is rejected. Emails and stored codes now share the same ten-minute expiry policy. Production response bodies do not disclose account existence or reset codes.
- **Backend resource use:** leaderboard queries select only required nutrition/preference fields; independent reads run concurrently, and name lookups deduplicate IDs. These reduce fetched data and sequential waits; no production CPU, latency or memory percentage improvement is claimed without measurement.
- **Workout sharing:** summaries contain confirmed exercise/set values and duration. Android uses a native share-sheet bridge; browsers use sharing, copy or text-download fallback. Cancellation is handled without an error. Private account/contact data and workout URLs are excluded.
- **Administrator actions:** normal analytics uses the protected API instead of forced samples; a late response from an older range cannot overwrite the current range. CSV formula-like strings are neutralized. Exercise edit, publish/unpublish and confirmed deletion use the existing protected catalog APIs. Saved workout snapshots retain their exercise/result history.
- **Foreground safety:** backgrounding/locking stops native monitoring and camera activity, cancels an untriggered countdown, and shows a paused-monitoring notice. Monitoring requires explicit resume. Generation checks prevent asynchronous sensor/location work from resurrecting a stopped monitor. A previously triggered alert is not silently marked resolved.
- **Compatible dependency patches:** source-map-js 1.2.2 and backend tmp 0.2.7. Backend audit is clear; residual Expo toolchain findings are tracked separately.
- **Deployment preparation:** a Render blueprint for web, account API and library API; public HTTPS release guards; EAS preview/production profiles; deployment and recovery-rollout instructions. Public URLs, signing and accounts are intentionally unconfigured.
- **Documentation:** ERD, editable draw.io, rendered collection image, data dictionary and Android network diagram updated for 15 collections, including recovery rate limits and JWT revocation fields.

## Verification

| Check | Result and scope |
|---|---|
| Backend suite | 356 tests across 45 files; controlled service/validation/provider scenarios. |
| Frontend/mobile Node suites | 144 checks, including native monitor lifecycle, share summaries/bridge, CSV handling and release URLs. |
| Browser suite | 43 scenarios, including request/grant recovery, admin edits/deletion, analytics range races, foreground-monitor resume and existing workout/video/date journeys. API requests are intercepted in these scenarios. |
| Real database checks | Two passed: full application startup, and recovery transactions in a randomly named isolated Atlas database. The latter checks concurrent single use, cooldown, password update, session-version increment and rollback after a failed account update. Synthetic records were removed with their isolated database. No real email was sent. |
| Build / static checks | Backend and frontend production builds, mobile TypeScript, and frontend/backend lint passed. |
| Android export | 1,398 modules; Hermes bundle approximately 5.1 MB plus local pose model approximately 5.8 MB. This is an asset export, not a signed APK/AAB or device test. |
| Dependency audit | Backend: zero findings. Root/workspaces: 23 package-tree findings, 16 high and 7 moderate, from three underlying toolchain advisories. See the dependency report. |

Execution evidence is in local `artifacts/final-*` logs. The opt-in real recovery check is `PQ_RECOVERY_DB_TEST=1 npm run test:e2e -- --hookTimeout 45000 --testTimeout 30000` from backend with a configured reachable Atlas/replica-set URI. It never selects the application database for its cleanup.

## Remaining release work

1. Create/configure the Render services and public URLs, staging database/network access, trusted proxy settings, provider credentials, backups and monitoring. Apply/rehearse the coordinated recovery rollout and verify declared indexes. Password reset requires MongoDB transaction support.
2. Associate the EAS project and signing account; build/install a signed Android candidate. Check real phone permissions, camera/video codecs, foreground/background transitions, sharing, startup, battery, heat and memory on supported devices and on mobile data.
3. Verify reset-email receipt, food providers and one controlled safety delivery with a consenting contact. No such external messages were sent during this work. Test complete persisted staging journeys with two accounts and verify isolation.
4. Review/recheck the remaining Expo toolchain advisories and the actual build/signing paths before release. The report assigns follow-up to the project maintainer for October 25, 2026; no scheduled automation was created.
5. Validate supported local form-feedback checks and counting accuracy using labeled real clips and actual phones. No new form score or accuracy claim has been invented. Pose processing remains on-device; no Render pose-analysis service exists in this change. Keep manual logging available.
6. Review account-enumeration timing before public recovery rollout: response bodies are neutral, but configured email delivery is currently awaited for existing accounts, so response timing is not guaranteed uniform. A durable asynchronous delivery design and provider failure/retry evidence remain outstanding; do not describe the flow as fully timing-resistant.

The implementation closes the listed local code gaps and prepares staging. It does not establish production readiness or complete the external/device release gates.

Related: [Render setup](RENDER_DEPLOYMENT.md), [dependency disposition](DEPENDENCY_AUDIT_2026-10-18.md), [remaining-issues plan](REMAINING_ISSUES_PLAN.md), [data dictionary](DATA_DICTIONARY.md), [editable ERD](diagrams/PhysiqueQuest-ERD.drawio).
