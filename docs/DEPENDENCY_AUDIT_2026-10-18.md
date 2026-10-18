# Dependency audit — October 18, 2026

Initial npm audit of the root/frontend/mobile workspace lockfile. Backend has its own lockfile and is not included in these counts. Advisory counts are dependency-tree findings, not demonstrated attacks or device test failures.

Reported totals: **17 high, 7 moderate, 0 critical**, affecting 24 package entries including transitive/parent entries. Four underlying advisory sources were listed.

| Dependency | Severity | Advisory | Automated fix reported |
|---|---|---|---|
| braces | high | [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | False |
| node-forge | high | [node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | False |
| source-map-js | high | [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | True |
| uuid | moderate | [uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | False |

At the initial snapshot, no forced npm audit fix or Expo/React Native upgrade was applied. SDK/native-module compatibility requires a separate dependency update with exports and device testing. The linter was added as a development-only tool. A fixable source-map-js advisory can be handled in that dependency update; dependency presence alone does not establish exposure in the shipped Android app.

The fresh raw report is saved locally at `artifacts/audit-dependencies.json` (ignored test artifact).

## Backend lockfile

The independent backend audit reported {"info": 0, "low": 3, "moderate": 0, "high": 1, "critical": 0, "total": 4}.

| Dependency | Severity | Advisory | Automated fix reported |
|---|---|---|---|
| tmp | low | [tmp allows arbitrary temporary file / directory write via symbolic link `dir` parameter](https://github.com/advisories/GHSA-52f5-9888-hmc6) | False |
| tmp | high | [tmp has Path Traversal via unsanitized prefix/postfix that enables directory escape](https://github.com/advisories/GHSA-ph9p-34f9-6g65) | False |

## Remediation verification — October 18

The later remediation supersedes the counts above. Root/workspace audit: **16 high + 7 moderate = 23 package-tree findings**, representing three underlying advisories. Independent backend audit: **zero findings**. No critical findings were reported. Raw refreshed reports: `artifacts/remediation-root-audit.json` and `artifacts/remediation-backend-audit.json`.

- Root override pins `source-map-js` to 1.2.2, removing that advisory.
- Backend override pins `tmp` to 0.2.7. Version 0.2.6 was insufficient against a newly reported advisory, so it was advanced and audited again.
- Expo/React/React Native versions were retained. Builds, types, automated suites and Android Hermes export were checked; no signed binary or physical device was tested.

| Remaining dependency and installed path | Exposure assessment / mitigation | Follow-up |
|---|---|---|
| `braces@3.0.3` via `micromatch` → Metro file-map/build tooling | Pattern parsing in developer/build tooling. Use trusted project sources and configuration; do not accept arbitrary glob patterns from users. Fresh audit reports the affected range as all versions, with no fix. This is not proof the vulnerable operation is present in the shipped app. | Project maintainer: recheck upstream and Expo compatibility by October 25, 2026. |
| `node-forge@1.4.0` via Expo CLI/code-signing-certificate tooling | Signature/certificate verification tooling. Do not treat untrusted certificates or signatures as safe; verify the actual release/signing path before distribution. No patched version reported by the fresh audit. | Project maintainer: review signing path and upstream fix by October 25, 2026. |
| `uuid@7.0.3` via `xcode@3.0.1` → Expo config plugins | Older tooling path; advisory concerns supplied-buffer bounds in affected generators. No application use of those buffer APIs was established by this review. Use supported parent updates; a forced major override has not been compatibility-tested. | Project maintainer: recheck parent/Expo updates by October 25, 2026. |

These are documented residual risks, not a release clearance. A native build dependency inventory and review of the actual affected operations remain required. Keep build agents restricted to trusted sources. The audit report alone cannot establish reachability or absence of exploitation.
