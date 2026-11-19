# Gemini scanner troubleshooting

As of 2026-11-15 the configured `gemini-3.6-flash` is documented for image input and structured output. The SDK uses the Gemini Developer API with the server-side `GEMINI_API_KEY`; the comparable direct request uses `v1beta/models/{model}:generateContent` with `x-goog-api-key`. Model metadata success does not prove generation access. Consult [model documentation](https://ai.google.dev/gemini-api/docs/models), [API key guidance](https://ai.google.dev/gemini-api/docs/api-key), [generation documentation](https://ai.google.dev/gemini-api/docs/generate-content/text-generation), and [API errors](https://ai.google.dev/gemini-api/docs/api-errors).

Observed locally: DNS resolved and HTTPS connected; model metadata returned 200 in 309 ms. REST text returned 200 in 15,861 ms and SDK text returned successfully in 15,094 ms, both with usage metadata. Image and structured image requests separately timed out at about 20 seconds, but a later image request completed in 11,011 ms and a later structured synthetic-image request completed in 14,202 ms (1,344 input, 4 candidate output, 1,375 total tokens). The authenticated scan endpoint previously returned 504 at 20,192 ms with usage unavailable. These are different attempts at different times. The precise cause of intermittent generation timeouts is unknown; latency or availability is variable, and no proof identifies whether provider, network or account conditions caused it. No model or application timeout was changed based on these observations.

Build the backend and run `node --env-file=.env scripts/foodscan-live-smoke.mjs --live --mode metadata`, then `rest-text`, `text`, `image`, `structured`, and optionally `app`. These calls can incur charges. `app` needs an isolated account's `FOODSCAN_DIAGNOSTIC_URL` and `FOODSCAN_DIAGNOSTIC_TOKEN`; the synthetic image is not an accuracy test. Record response category and elapsed time, never credentials or image bytes. If generation fails, check AI Studio project access, key restrictions, API enablement, quota, billing and regional availability; ask the project administrator or provider support where needed. Compare direct REST and SDK with the same model/key. DNS success and metadata 200 are not generation success. Do not log provider bodies or key-bearing URLs.

The application retains its configured provider timeout and overall deadline, cancels the provider request, and surfaces a retryable error rather than waiting indefinitely. A retry can be billable even when usage is unavailable. A real consented food photograph still needs verification.

A subsequent authenticated scanner request using the same synthetic image succeeded with HTTP 200 in 5,871 ms; its isolated usage ledger recorded success and provider metadata. This verifies one application-path generation, not reliability or real-food identification. Earlier attempts did return 504 with the same general configuration.
# Follow-up observation (2026-11-15)

One additional live REST text request using the configured `gemini-3.6-flash`
returned HTTP 200 in 11.522 seconds with usage metadata available. This single
observation does not establish a latency distribution or explain prior image
and structured-output timeouts. No model or timeout change is justified by it.
The synthetic image used by the smoke script is not a real-food evaluation.

