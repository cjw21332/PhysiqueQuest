# PhysiqueQuest UI/UX audit — v1.6.3

Scope: the signed-in app (Home, Coach, Scan, Quests, Me, Phiq) in both online and offline modes, checked in source, by automated tests and on an Android phone (CPH2591, 720×1612) running the 1.6.3 standalone APK. Rules come from [DESIGN.md](../DESIGN.md).

Status: **Pass** = present and verified; **Fixed** = gap closed in 1.6.3; **Open** = known gap, not fixed in this release.

| Area | Status | Evidence | Changed in 1.6.3 |
|---|---|---|---|
| Visual consistency | Fixed | Shared dark tokens in `app/theme.css`; browser palette check (`tests/browser/theme-layout-helpers.mjs`) | Scan, Phiq and Me moved to one card language (22px cards, accent tiles, green-to-mint primary). Quests journal and badge UI purple, cyan and yellow mapped to the violet, sky and amber tokens. |
| Typography | Pass | Bundled Inter; scoped roles in DESIGN.md; Title Case display names | Section labels in Me and Phiq unified to 11–12px uppercase tracked labels. |
| Color | Fixed | Four documented accents with fixed meanings (DESIGN.md › Accents) | Added teal, violet, sky (+ tints), aliased amber; palette check allows exactly these. Accent mixes use transparency, never new solid colours. |
| Spacing & layout | Pass | 440px mobile frame, 20px gutters, 14px under 360px, 44px targets | New cards keep 14–18px padding and 8–10px list gaps. |
| Components | Fixed | Buttons, chips, cards, toasts, dialogs | Send feedback dropdown is full width (no unit-suffix divider); editors get a "Send feedback" label instead of "Save changes". |
| Iconography | Pass | Single shared registry `sections/Home/icons.tsx` | Icon tiles now carry their section accent. |
| Responsive UI | Pass | Specs at 320/390/768/1440px; no horizontal scroll | Redesigns use wrapping grids and `minmax(0, 1fr)`. |
| Accessibility | Fixed | Labels, roles, live regions, reduced motion | Focus rings now appear only for keyboard navigation (`InputModality`); one highlight per field (no double rings or halos); colour is never the only cue (labels beside every dot or bar). |
| Loading | Pass | Skeletons (Scan, Coach programs, Goals), "Phiq is thinking", spinners in toasts | Phiq waiting state gains a pulsing indicator. |
| Empty | Pass | Scan empty state, meal diary "No foods logged yet", programs "No saved programs yet", library "no results" | Carbon card hides until meals exist. |
| Error | Fixed | `role="alert"` messages with Retry across sections | 401/403 framework defaults now read as session/permission messages; Phiq errors in a coral card with Try again. |
| Success | Pass | Toasts ("Set saved", "Thanks! Your feedback was sent"), saved states | Feedback send confirms with a toast and returns to Me. |
| Design system | Fixed | DESIGN.md + theme.css + palette check kept in step | Documented accents, Scan/Phiq/Me patterns, network states and the one-highlight rule. |
| No internet | Pass | `SessionBoundary` offline toast (Try again / Continue offline); offline account; workouts queue in IndexedDB and sync on reconnect, focus and the `online` event | `online` event added as a sync trigger. |
| Slow network | Fixed | Render cold-start "Connecting to PhysiqueQuest" toast; capped calls throw `ApiTimeoutError` | New "Slow connection" toast for any request running past 6s (except chat and photo scans). |
| No search results | Pass | Add food "0 found / Search or choose a recent food", exercise library and admin library no-result messages | — |
| Permission denied | Fixed | Camera denial keeps manual logging; notification denial explains settings; location denial still alerts | Framework 403 → "You don't have permission to do that." |
| Session expired | Pass | Refresh failure → "Session expired. Sign in again."; toasts "Sign in to sync" (online) vs offline notice (offline never claims expiry) | Framework 401 → "Your session expired. Sign in again." |
| Form validation | Pass | Required fields, inline `role="alert"` messages, retained input after failure (auth, calibration, editors, routine sets, feedback) | Feedback form validates rating and message length before sending. |

## Open items (not fixed in 1.6.3)

- Food logging still needs a connection; only workouts queue offline (stated in the offline toast).
- Several older browser specs fail on the original code too (copy and layout drift: Phiq copy, Skip exercise moved into Options, admin and Coach library controls, badge order). They need updating to the current UI.
- Badge crest artwork keeps its own metal palette by design (documented exception).
- iOS has not been run on a device; the iOS build needs an Apple Developer account (see RUNNING.md › iOS build).
