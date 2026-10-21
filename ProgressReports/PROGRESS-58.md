# PhysiqueQuest-v3.1.2 release preparation — October 22, 2026

User requested publication of the complete current project to `PhysiqueQuest-v3.1.2`, then advancement of `main` to the same release. Remote `main` is an ancestor of this checkout; no overwrite or force push is needed.

## Included updates

- Auth and internal links use client navigation; removed redundant branded loading interstitials.
- Shared field focus uses a single accent border; password visibility controls retain an integrated field boundary and inset keyboard indicator.
- CORS preflight bypasses business-query validation, while actual request validation remains active. Independent Coach calls omit account credentials and account-only headers; refresh diagnostics identify failed resources.
- Email verification has a dismissible floating reminder, reactive session updates, usable confirmation flow and honest local-delivery guidance.
- Development origins permit arbitrary IPv4 addresses. Added light EmailJS HTML/plain-text source files and dashboard activation instructions; local files do not update the external dashboard.

## Pre-publication verification

- Backend: 68 test files / 503 tests passed; Nest production build passed.
- Frontend: complete Node test suite passed; Next production build passed, including TypeScript and all 18 static pages.
- Mobile: complete top-level Node test suite and TypeScript check passed.
- Prior targeted browser verification: six desktop/mobile-sized focus and verification-alert checks passed. User reports successful testing of the update.
- Commit contents are reviewed against Git ignore rules; local credentials, node_modules, build output and screenshots are excluded. Secret scans are run before publication.

## Remaining external checks

EmailJS dashboard Save/Test and actual Gmail desktop/mobile delivery are not verified by repository builds. Physical Android/iOS WebView checks, deployment activation, provider accounts and inherited dependency limitations remain documented in the existing checklist. This release does not claim those outstanding items completed.

Remote publication is verified separately after the push; this report records the release contents and preparation evidence.
