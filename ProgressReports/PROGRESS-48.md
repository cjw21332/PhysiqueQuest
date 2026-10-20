# Progress 48 — CSS duplication and legacy overrides

October 20, 2026

Distilled the current CSS cascade without redesigning screens or changing features, backend connections or saved data.

Net stylesheet reduction from the pre-cleanup working tree: 29,528 bytes (about 28.8 KiB).

Removed:

- 596 redundant declarations from globals.css. Each removed value is identical to its final equal-selector/property/importance declaration in the same parent context; nothing was hoisted across conditions or reordered across competing selectors.
- 49 rules left empty by that removal.
- Seven obsolete navigation height/flex declarations across globals.css and coach-reference.css. The current shared accessibility sizing remains authoritative and continues to allow large-text reflow.
- The unimported, tracked 881-line legacy copy at frontend/app/frontend/app/responsive-globals.css. Repository searches found no code import/reference; its outdated design-rule note is corrected.

Kept differing-value compatibility fallbacks, media/supports/container/layer boundaries, theme tokens, reduced-motion/focus styles, safety states, touch floors and all active scoped Coach/library styles. No new dependency or runtime abstraction.

Evidence:

- Theme browser tests: 14/14 before, 14/14 after. Coverage includes authentication/calibration, dashboard/goals/progress, account editors, nutrition, Coach/library/camera/session/report, admin and overlays.
- 50 paired screenshots: 46 pixel-identical. Remaining pixel changes are confined to the dynamic fake-camera frame (x89–295/y168–455), goals scrollbars (x352–355) and Next.js development badge (x19–114/y787–843); inspected camera/error screenshots confirm unchanged surrounding UI. No image dimensions changed.
- Dedicated mobile-accessibility browser check passes at 100/200% label size, narrow phone/portrait/landscape/tablet, 48px navigation/day targets and synthesized touch navigation.
- Frontend Node tests: 116 passed. Production build/TypeScript passed. git diff --check passed.
- Independent read-only review found no actionable cascade/navigation regressions.
- Transformation counts and raw image comparison: artifacts/css-distill/. Captures: artifacts/css-distill-before/, css-distill-after/ and css-distill-accessibility/.

No commit/push, physical-device/browser-engine matrix or deployed-service test. The remaining stylesheet still contains intentional theme and responsive overrides; these were retained where removal could alter the cascade. This cleanup does not claim every legacy selector is dead.
