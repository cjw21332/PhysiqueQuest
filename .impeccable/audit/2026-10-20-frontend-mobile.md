# Technical UI audit — 2026-10-20

Assessment B, independent of the design reviewer. Target: current Next.js frontend in Expo WebView, plus mobile/App.tsx host boundary. The future adaptive native product is not scored as implemented.

## Implementation integrity verdict

Qualified pass for a coherent fitness-specific system, with release issues. Current tokens, exercise catalog, nutrition estimates, saved activity, and explicitly labeled samples establish product specificity. The launch promise still overstates current form-watching capability. The source contains substantial superseded presentation layers; detector counts cannot be interpreted as current visible failures.

## Audit health

| Dimension | Score /4 | Basis |
|---|---:|---|
| Accessibility | 2 | Password recovery cannot be reached normally by keyboard; its overlay leaves background focus active. |
| Performance | 3 | Debounced catalog and delayed detail/media loading; no measured runtime regression established. Provisional source score, not a speed benchmark. |
| Theming | 3 | Shared deliberate dark tokens and scoped overrides; a large legacy literal-color layer remains. |
| Responsive design | 3 | Mobile frame, safe areas, narrow breakpoints and enlarged outer hit areas; host text zoom is fixed and native camera switch is undersized. No physical-device pass claimed. |
| Implementation integrity | 2 | Coherent product, but launch capability promise and repeated superseded CSS obscure actual behavior. |
| Total | **13/20** | **Acceptable: significant work needed.** |

Scores are evidence-limited triage judgments, not WCAG certification. Authenticated screens received source review only.

## Verified issues

### P1 — Keyboard users cannot normally open password recovery

Location: frontend/sections/Auth/AuthForm.tsx:111. The action is an anchor with only onClick: no href, role/button semantics, tabIndex, or keyboard handler. The browser accessibility representation calls it a link, but source makes it absent from ordinary keyboard traversal. Replace it with a type=button action, retaining its visual styling. Category: Accessibility; WCAG 2.1.1 Keyboard and 4.1.2 Name, Role, Value. Suggested command: `$impeccable harden`.

### P1 — Recovery overlay does not establish modal focus or dismissal

Location: frontend/sections/Forgot Password/ForgotPasswordFlow.tsx:160–170. The active overlay and modal are plain divs, without dialog/aria-modal semantics, initial focus, background inertness, focus containment/restoration, or Escape handling. Browser verification on /login: opening Forgot Password then pressing Tab focused the underlying Log in button; Escape left the overlay open. The background login form remained in the accessibility tree. Screen reader and keyboard users can operate obscured content and lose their place. Use the same native-dialog/focus pattern as ExerciseLibrary, label it, focus its first control, restore the opener, and support Escape where safe. Category: Accessibility; WCAG 2.4.3 Focus Order and 4.1.2, modal-dialog pattern. Suggested command: `$impeccable harden`.

### P1 — Launch promise presents unavailable automatic coaching as current

Location: frontend/app/launch/page.tsx:105 and :113. Public rendered copy says “coaching that watches your form” and camera permission is “Needed for form tracking.” PRODUCT.md explicitly records removed camera-counting entry points and says form-teaching intent must not imply automatic camera assessment is available or validated. The live launch screen presents the unconditional promise before users can learn the limits. Describe implemented guidance/manual tracking accurately and place camera access in the feature context that actually uses it. Category: Implementation Integrity. Suggested command: `$impeccable clarify`.

### P2 — Navigation and safety-threshold selection omit programmatic current state

Locations: frontend/sections/Home/BottomNav.tsx:29–35; frontend/sections/Me Section/MeSection.tsx:120–121. Bottom navigation derives its current tab only through className; inactivity threshold similarly exposes selected styling without aria-pressed or checked state. The public /exercises accessibility tree showed five navigation buttons with no current state. Users who cannot perceive the green treatment must infer location or the saved safety threshold. Add aria-current=page to the current navigation item and aria-pressed, or native radio semantics, to thresholds. Category: Accessibility; WCAG 1.3.1 and 4.1.2. Suggested command: `$impeccable harden`.

### P2 — Host fixes web text zoom at 100%

Location: mobile/App.tsx:322. textZoom={100} sets a constant web text-zoom value at the native boundary. Review it against device font-size settings and preserve a supported scaling route for the web content; the product direction explicitly requires system text scaling. This is a source-backed conformance concern, not proof of behavior on every Android/iOS WebView. Native Text itself retains default font scaling; this finding does not say all native text is locked. Category: Responsive / Accessibility. Suggested command: `$impeccable adapt`.

### P2 — Native camera-facing hit area falls below platform requirements

Location: mobile/App.tsx:493–499 and :618–625. The labeled Pressable has minHeight:34 with no hitSlop; its content does not guarantee 44pt iOS or 48dp Android target height. Make its outer interaction surface meet the platform minimum independently of its compact appearance. Category: Responsive. Source-only, no physical touch test. Suggested command: `$impeccable adapt`.

### P2 — Connection recovery field lacks an explicit accessible label

Location: mobile/App.tsx:564–575. Computer address is a sibling Text; TextInput supplies a placeholder but no accessibilityLabel or labelledBy relationship. Explicitly expose the field's purpose rather than relying on the example URL, especially when the field is populated. Category: Accessibility; platform accessible naming. Suggested command: `$impeccable harden`.

### P2 — Global CSS maintains conflicting historical systems

Locations: frontend/app/globals.css:160, :1947, :3358, :8171, :9113, :9588–9624. The same auth/library/account controls are redefined across miniature light-era styles, responsive replacements and final dark scopes. Example: library filter height appears as 24px, then 32px, then a 44px outer target; the current 32px inner span is intentional, not a 32px hit target. This creates maintenance risk and makes future edits/detector results misleading. Consolidate after preserving computed output and approved exceptions; do not blindly replace all literals or flatten screen-specific geometry. Category: Theming / Implementation Integrity. Suggested command: `$impeccable distill`.

Counts above: P0 0, P1 3, P2 5, P3 0. These are eight actionable issue groups, not 1,606 user-visible defects.

## Detector evidence and disposition

Command: `rtk proxy C:/Users/MY PC/.agents/skills/impeccable/scripts/impeccable.cmd detect --json frontend` (PowerShell captured JSON to review-work/detector-raw.json). Detector process exit 2 means findings. The RTK wrapper reports a nonzero wrapper status; the inner process code was explicitly printed as DETECTOR_EXIT=2.

**1,606 rule matches; seven distinct rules; 1,290 unique file:line locations; four reported files.** Multiple matches may share one line.

| Rule | Matches |
|---|---:|
| design-system-color | 748 |
| design-system-font-size | 617 |
| design-system-radius | 214 |
| overused-font | 12 |
| bounce-easing | 10 |
| design-system-font | 3 |
| side-tab | 2 |

File distribution: globals.css 1,490; app/frontend/app/responsive-globals.css 77; sections/Coach/coach-reference.css 29; sections/Coach/libraryreference.css 10.

The 77 matches in nested responsive-globals.css are not evidence of shipped rendering: no import of that file was found in frontend. CoachSection.tsx:3 does import coach-reference.css; its 29 signals must be evaluated against final dark scopes. These file-scoped groups are not separate totals to add to findings. Check external tooling before deleting the nested stylesheet.

Confirmed false-positive / non-actionable examples:

- All 12 overused-font matches are not proof of generic design: 11 flag Inter, which is explicitly approved and locally bundled; the Arial match is in imported coach-reference.css and requires cascade review. Three design-system-font flags for Roboto/Arial also contradict DESIGN.md's documented system fallback prose. Do not add new fonts to satisfy this detector.
- globals.css:512 flags workout-card::before as an accent stripe; :5946 explicitly sets that pseudo-element to display:none. It is not a current rendered stripe defect.
- Font-size/radius rules treat frontmatter as a complete universal ramp, while DESIGN.md explicitly preserves per-screen exceptions, including 11px filters and dense labels. At least the libraryreference.css:6 11px flag is documented. Such matches need ownership/cascade review, not mass normalization.
- Light colors in earlier CSS are frequently superseded by theme.css tokens and final dark scopes. Example library colors at :3325 and :3364 are replaced by :9108 and :9114–9115. Public library rendering was dark. Do not claim 748 current palette failures.
- Bounce easing is a deterministic source occurrence, not measured frame loss or an automatic usability defect. Several current entry scopes disable animations (:8648). No runtime bounce failure was demonstrated.

The remaining matches are **unverified advisories**, not individually cleared false positives. All 1,606 were grouped and traced by rule/file; exhaustive computed-style validation of all 1,290 locations was not performed. The evidence supports a legacy CSS consolidation issue, not an invented total of visible defects.

## Browser coverage and limitations

Fresh hidden in-app-browser tab at localhost:3000, redirected to /launch. Inspected launch, /login, the open recovery overlay and /exercises using accessibility trees and screenshots. Viewport in screenshots was 1280×720. Exercised recovery open, Tab and Escape; no form submission, credentials, account changes, camera permission or user data were used. Public library showed its loading state during capture; catalog success/detail playback was not claimed.

Browser evidence is web desktop viewport evidence only. No synthesized touch, device rotation, 200% zoom, mobile viewport matrix, screen-reader application, physical Android/iOS device, or authenticated end-to-end flow was exercised. Source coverage included all five primary section families through repository scan and targeted semantic/style searches, detailed auth/recovery/library/navigation/settings/quests review, and parent-provided native host checks. It is not a rendered pass of every authenticated screen or state.

No user-visible detector overlay exists. Available evaluate APIs are documented read-only, so mutable script injection was unavailable; no forbidden mutation was attempted, no live visualization server was started, and no detect.js overlay is claimed. CLI detector plus native browser screenshots/AX inspection are the fallback signal.

No Lighthouse, profiler, bundle analyzer, frame-time, network throttling or Core Web Vitals measurements were taken. Performance score is provisional. No claim of real-device speed or camera accuracy is made.

Native-host additional concern (not a separately counted proven defect): App.tsx has no BackHandler wiring; mobile/app.json:21 disables predictiveBackGestureEnabled while App.tsx:307 allows iOS back/forward navigation gestures. Verify Android back behavior and navigation-state integration on device before attributing an actual navigation failure. This source asymmetry is insufficient to assert that Android Back exits incorrectly.

## Positive evidence

- theme.css establishes one deliberate dark palette independent of OS theme; global layout loads theme after legacy globals.
- Library outer filters and close controls are enlarged to 44px despite compact visible pills; the scanner would otherwise encourage a false small-target finding.
- ExerciseLibrary uses native dialog.showModal(), Escape cancellation and opener restoration; it debounces catalog requests, guards stale responses and fetches details only when opened.
- Main controls have accessible labels; nutrition and activity screens expose status/alert feedback and retry paths. Notifications and admin previews are explicitly labeled sample data rather than silently fabricated live records.
- Local Inter uses font-display:swap; media is restricted to relevant views rather than a large always-rendered gallery. These source practices do not establish measured performance.

## Recommended actions

1. `$impeccable harden`: recovery button/dialog keyboard behavior, navigation/threshold states, native field name.
2. `$impeccable clarify`: accurately state available form guidance and camera behavior at launch.
3. `$impeccable adapt`: verify system text scaling, native target geometry, and Android Back on actual devices.
4. `$impeccable distill`: consolidate superseded CSS after computed-style regression checks across public and authenticated states.
5. `$impeccable polish`: final visual pass after behavioral fixes.

Re-run `$impeccable audit` after fixes. No source fixes, persistent application writes, server lifecycle changes, or checklist completion changes were made during this audit.
