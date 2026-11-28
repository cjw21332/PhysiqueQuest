# UX audit 1.6.9 (2026-11-28)

Follows `docs/ux-audit-1.6.8.md` and covers what that pass left open: phone and tablet layouts, empty states, visual consistency, the sign-in screens on the phone, plus two bugs reported during the pass.

## Bugs reported on the phone

- [x] **Log out did not stick.** After Me › Log out, the app signed the user back in by itself. A logout that cannot reach the server (for example while it wakes up) used to end only the local session, so a leftover refresh cookie or device sign-in could restore it on the next start.
  - Fix: logout now sets a signed-out marker (`physiquequest-signed-out`). While it is set, `SessionBoundary` skips every automatic restore and tells the shell to forget its stored sign-ins. Only an explicit sign-in (email, register, Google) clears it.
  - The shell also never links a new device sign-in after a logout arrived (`mobile/App.tsx`, `forgetCount`).
  - Test: `tests/logout-sticks.test.mjs` (2 pass). **Not yet proven on the phone**: that needs sign in → Log out → reopen, and the user's password.
- [x] **Blank screen.** Measured with on-device frame captures (one every ~0.45 s).
  - Cold start showed ~2.7 s of empty dark screen between the Android logo splash and the brand intro, while React loaded. `MainActivity` now holds the logo splash until the intro reports it has mounted (`PQShell.introShown`, capped at 6 s). Re-measured on the phone: logo, then intro, with no empty frame.
  - The app started on `/` and logout went to `/`, an empty redirect page. Both now go straight to `/launch`.
  - Register showed a "Checking your saved profile" placeholder for one frame on every visit; it now appears only when a saved sign-in exists.
  - Log in ↔ Register switches: no blank frame measured.

## Phone and tablet layouts (`ui-audit.spec.mjs`, 34 routes)

- [x] 360 px (common Android) and 768 px (tablet) added; the phone itself is 360 dp wide. No screen scrolls sideways at either width.
- [x] Fixed: white text on the coral notification badge (2.6:1, now dark text), Coach fine print and Programs weekday letters (raised to `--muted`), text below 11 px (Home "LEVEL" 9 px, Programs weekday letters 9.5 px, "days" 10 px, Home "of 2,300" 10 px → 12 px like every other calorie goal, badge tier and XP labels).
- [x] Accepted as is: Coach day buttons are 42 × 62 px (above the 24 px WCAG 2.5.8 minimum); the 24 px checkboxes sit inside tappable labels; the unselected rating star (3.56:1) is a graphic, which needs 3:1; the supplement filter chips are a deliberate side-scrolling row.
- [ ] Not changed: inputs are 15 px on tablet width, which makes iOS Safari zoom on focus. The app ships on Android, where this does not happen.

## Empty states

- [x] Every data list has an empty message in code (grep of every `.map(` render; the rest map fixed option lists).
- [x] Rendered with an empty account (`PQ_AUDIT_EMPTY=1`) at 360 px; screenshots reviewed for Home, Food history, Notifications and Leaderboard. Fixed: Home showed a "0/0" missions counter next to "No missions available right now"; the counter now hides when there are none.
- The phone account has data, so the empty states were checked from these screenshots, not on the phone.

## Visual consistency (rendered style census across routes)

- [x] Page headers: title weight was 500, 650 or 700 depending on the page; now 650 everywhere through the shared `.pq-page-heading` rule.
- [x] Me edit footers: Discard (16 px, regular) and Save (15 px, semibold) side by side now share one type style and corner.
- [x] Programs inline error used `#fca5a5`; now the app coral `#f87171`.
- [x] "Could not restore your session" (web, server unreachable at start) was unstyled text in the top-left corner; now a centred screen with an icon, explanation and a primary **Try again** button. It does not appear in the phone app, which opens without waiting for the server.
- Off-palette colours left on purpose: badge rarity tiers and category colours, the launch logo tile.

## Checked on the phone (1.6.9, CPH2591, Android 15)

- Log in with empty fields: both fields show their message and red border, focus moves to email; the message clears while typing and returns on submit for `test@nodomain`.
- Forgot password with `bad@x`: red border and "Enter a valid email address"; nothing sent.
- What's New 1.6.9, Home at 360 dp (larger "LEVEL" fits the ring), cold start with no blank gap.

## Still open

- Prove on the phone that Log out sticks (needs the user to sign in first).
- Re-check on 1.6.9 the 1.6.8 items earlier marked as phone-verified (library no-results, red Discard workout): the phone turned out to have 1.6.7 installed, so that earlier check was not on 1.6.8.
- No internet and slow network on the phone: these toggle the phone's Wi-Fi and data and set a temporary proxy, so they wait for the user's go-ahead.
- `connection-toast.spec.mjs` gained a slow-network test that has not been run yet.
