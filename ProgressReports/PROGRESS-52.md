# Progress 52 — Library layout and camera-check startup

October 20, 2026

Improved the current exercise library rather than replacing its visual identity. Search is followed by a labeled muscle group with wrapped choices, Equipment disclosure showing its current value, and Clear filters when search/filter state is active. API-backed result counts use correct singular/plural. Guide rows show full wrapping exercise names and metadata, with tracking/demo availability on a separate line and a trailing guide affordance. Replaced the pause glyph with the shared icon. Entry scroll resets and the library heading receives focus so navigating from a scrolled plan does not conceal the library header.

Preserved provider queries, search debounce/stale-response guard, pagination, preselected equipment, native detail-dialog/Escape/opener focus behavior, provider attribution, error/empty/retry states and demonstration playback.

Fixed camera-check → Start session throwing crypto.randomUUID is not a function on LAN HTTP/WebViews. New request-key helper detects support and uses randomUUID, getRandomValues, or timestamp/random fallback. The key remains stable across startup retries through existing startAttempt; it is an idempotency ID, not a token. No backend change is required.

Validation:

- Coach/library browser suite 14/14. Includes API search/filter/pagination, real detail fetch/retry, failed media recovery, playback/pause, Escape focus restoration, responsive sheets, admin catalog/authorization regressions and complete workout lifecycle.
- Lifecycle test explicitly removes randomUUID and asserts a getRandomValues-based request key reaches session creation, then exercises pause/resume/end/report.
- New long-name/filter layout test checks wrapping/no horizontal overflow at 320×568, 390×844, 844×390 and 1280×900, muscle choice visibility, keyboard Equipment disclosure and reset behavior.
- Frontend Node 117/117, including UUID/getRandomValues/no-crypto helper branches and fallback uniqueness/length checks. Production build/TypeScript and diff checks pass.
- Phone captures visually inspected. Evidence: artifacts/library-layout-final/.

No dependencies, backend/schema/data changes, commit or push. Browser APIs were mocked; physical phone, deployed backend and real provider availability were not tested. Reload/redeploy the frontend to use the startup fix in an existing installation.
