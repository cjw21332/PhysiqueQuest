# Progress 46 — Resumable calibration

October 20, 2026

User chose same-device/account progress storage. The existing four-step calibration now saves a versioned localStorage draft scoped by authenticated account ID and API base. It restores current step, form values and skipped sections after closing/reopening registration. Bounded draft validation rejects malformed data; storage failure is visible. Drafts contain no credentials and do not sync across devices.

Optional body measurements, weight target/date, camera guidance and health notes can be skipped and added again. Skipping clears those optional values rather than sending invented answers, and preserves required core personal data, training preferences and emergency contact validation. Camera guidance acknowledgment is no longer a prerequisite for continuing. Step changes scroll to the start and focus the heading. Skip controls have at least 44px height.

Registration recovery fetches the backend profile before continuing: existing profile goes home, missing profile resumes setup, failures offer retry/sign-in. Login passes through that check, including incomplete accounts that closed before any draft existed. Final completion remains a backend POST, has a pending/duplicate guard, retains drafts on failure, and clears them after confirmed completion. A lost response can recover an already-created profile with an authoritative GET. Async operations verify captured account/API scope and token before local writes, cleanup or navigation; server-returned values take priority in the local profile cache.

Evidence:

- Dedicated browser suite: 11/11. Close/reopen, restored step/contact, all optional skips, skip/add, required validation, failed save/retry, duplicate submit, successful cleanup, malformed/other-account drafts, unavailable storage, recovery retry, lost completion reply, login with/without drafts, account switch before/during final save.
- Existing onboarding browser suite: 2/2. Registration, calibration Back/Next, units, profile payload, scroll and login/recovery surfaces remain covered.
- Existing auth/nutrition hardening browser suite: 10/10. Account-created dialog identity changes are also covered by the dedicated suite. Auth regression captures: `artifacts/calibration-auth-regression/`.
- Frontend Node suite: 116/116. Production build and TypeScript passed.
- Viewports 320×480, 390×844, 768×1024 and 1440×900: footer action reachable, no horizontal overflow, skip targets at least 44px. Personal-data and recovered-health screens visually inspected.
- Screenshots: `artifacts/calibration-onboarding/` and `artifacts/calibration-onboarding-regression/`.
- Independent review identified async account-switch cleanup and login without a draft; addressed with scope checks and server-profile recovery routing.

No backend schema/endpoint changes, dependencies, commit or push. Browser API responses were mocked. No deployed API/database, physical Android/iOS device or real-user usability test was performed. Drafts do not survive clearing app/browser storage and are not available on another device.
