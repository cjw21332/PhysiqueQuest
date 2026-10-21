# Historical secret scan — 2026-10-21

Gitleaks v8.30.1 scanned all 141 reachable commits using `gitleaks git . --log-opts=--all --redact=100 --no-banner`.
The Windows release archive SHA-256 was verified against the upstream checksum file before use.

44 findings were reviewed without printing secret values:
- 24: test `idempotencyKey` strings in backend/test/inactivity-safety.spec.ts. These identify synthetic requests; they grant no access.
- 10: documentation prose following “access controls,” in .agents/rules/DATABASE.md, matched by the generic API-key heuristic.
- 10: the Nest starter README's placeholder CircleCI badge token.

Only these exact commit/file/rule/line fingerprints appear in the root .gitleaksignore. No rule or directory is broadly excluded. A new occurrence will still fail CI. No real credential was confirmed in this scan, so no rotation is required on the strength of these findings. This is scanner evidence, not proof that an undetectable or never-fetched credential has never leaked. All reachable local refs were scanned; deleted or unfetched remote history is outside that scope.

Raw reports are redacted and kept outside Git. To reproduce, install Gitleaks, run the command above from the repo root, and check for a nonzero exit. CI runs the same full-history scan with fetch-depth 0 and verifies the downloaded Linux release archive checksum.

Final hardening branch verification: all145 reachable commits, including the backend, client and documentation commits, scanned with the same exact baseline; no new leaks. The starter README badge token parameter was removed from current source. No broad suppression was added.
