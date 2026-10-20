# Progress 53 — USDA search request failure

October 20, 2026

User supplied backend logs showing USDA GET /foods/search returning 400 and surfacing as UPSTREAM_UNAVAILABLE 502. User confirmed searching chicken breast. Live probes confirmed the query can return 200, but repeated normal GET searches intermittently returned nginx HTML 400 pages. Changing connection reuse did not reliably resolve it. No evidence indicated a bad user query or invalid API key.

USDA documents JSON POST search with dataType as an array: https://fdc.nal.usda.gov/api-guide/. Four POST probes succeeded, including repeated chicken breast, rice and egg. Changed both candidate and scan ingredient searches to that documented request form. API key remains in the required query parameter and is never printed/logged. Food detail requests remain GET; ranking, limits, caches and app-facing API response contracts remain unchanged.

HttpService now accepts explicit GET/POST and a serialized body, defaults existing callers to GET, and preserves method/body/headers on its existing bounded server-error retry. Existing timeouts, rate-limit handling, URL redaction and error envelopes remain intact. No retry loop for 400s or fake/local food fallback was introduced.

Verification: request construction and POST retry regressions failed against old code, then passed after the change. Targeted nutrition suites: 52 passed. Backend lint and build passed. The compiled updated UsdaService/HttpService made two live searches for chicken breast; each returned eight candidates including chicken. Provider verification scripts are in artifacts/usda-search-debug/; they read the local key without printing it. These are read-only provider calls, not app account/database writes.

Restart/redeploy the backend if the running process does not reload changes, then retry the same search. No frontend change or account-data modification. No commit/push. Live provider availability can still fail; this change avoids the observed GET request path, not a guarantee about USDA uptime.

Final full backend unit run: 49 test files, 382 tests passed.
