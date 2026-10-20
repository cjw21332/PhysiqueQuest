# Progress 44 — auth, recovery and first nutrition logging

Date: October 20, 2026 (Asia/Singapore).

## Delivered

- Auth forms submit with Enter and browser required/email validation, expose busy/selected states, preserve failed inputs, and guard against concurrent submission. Forgot Password is a keyboard-accessible button. Removed the public QA email tip.
- Recovery uses a native modal dialog with a clear accessible name, background inertness, stage-specific input focus, Escape dismissal and opener restoration. Request/resend/verify/confirm actions guard in-flight requests. Existing API validation, tokens, cooldowns and error handling are preserved.
- Login and registration outcomes use native modal dialogs. Dismissible failures support Escape; account creation keeps its explicit Start calibration completion action.
- Added `/terms`, `/privacy`, and `/camera-consent` with plain accessible headings, an empty content section, and **Draft, pending team review**. Registration links open in new tabs with explicit labels and `noopener noreferrer`. No policy terms were invented. Team requirements are listed in [policy-review-todo.md](../docs/policy-review-todo.md).
- New nutrition accounts start with their real empty log. An explicit **View sample nutrition** control preserves the requested sample experience; **Start my log** exits it. Selecting a real photo exits samples. Normal first manual meals and water updates use existing authenticated APIs; samples remain local. Failed saves retain entered food/portion or the last-confirmed water state.
- Preserved the shared dark palette, existing layouts, navigation and API contracts. Added scoped styles for semantic dialog shells, policy drafts, keyboard controls and sample entry/exit.

## Verification

- New behavioral regressions were run before fixes and reproduced Enter-submit failure, keyboard-inaccessible recovery, missing policy links/QA copy, and sample-mode interception of initial logging.
- New Playwright hardening suite: **10/10 passed** with synthetic accounts and mocked API responses. Covers Enter/duplicate submit, modal focus/Escape/restoration, policy links/routes, recovery error/retry/OTP-stage focus, first meal and water persistence across reload, failed meal/water writes and preserved inputs, sample exit, and responsive bounds.
- Existing onboarding browser suite: **2/2 passed**. An initial parallel run lost its reused web server when the other runner finished; rerunning with a separately managed server passed.
- Existing journey suite: **6/6 passed**, with the sample-nutrition journey updated to opt in explicitly; shared overlay suite: **2/2 passed**, including all mocked password recovery stages.
- Full frontend Node suite: **114/114 passed** after the final functional changes.
- Frontend production build: **passed**, including all three policy routes.
- Screenshots in `artifacts/auth-nutrition-hardening/` cover registration/recovery at 320×480, 390×844, 768×1024 and 1440×900, plus the mocked saved first meal. Narrow registration, recovery and first-meal captures were visually inspected.

## Important files

`frontend/sections/Auth/AuthForm.tsx`, `AuthOutcomeModal.tsx`, the login/register routes, `frontend/sections/Forgot Password/ForgotPasswordFlow.tsx`, `frontend/sections/Scan/ScanSection.tsx`, `frontend/app/globals.css`, `frontend/components/PolicyDraft.tsx`, the three policy routes, and `frontend/tests/browser/auth-nutrition-harden.spec.mjs` with `playwright.harden.config.mjs`.

The detailed design/procedure rules, root design companion and system checklist describe the new behavior. Checklist completion marks remain unchanged because mocked browser persistence is not a genuine live frontend/API/MongoDB journey.

## Not verified / remaining

No live email delivery, actual password change, provider food search, real-account database journey, physical Android/iOS behavior, screen-reader application, or deployment verification. No backend contract or native source changes were made. Policy bodies, privacy contact and data collection/storage/retention facts still require team review and content.
