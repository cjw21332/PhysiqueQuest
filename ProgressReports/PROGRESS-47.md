# Progress 47 — Mobile touch, text and navigation

October 20, 2026

Adapted the existing Expo WebView host and shared bottom navigation; no native-screen migration or data/API changes.

Bottom navigation retains all five destinations and existing router/prefetch behavior. Accessible names clarify **Scan food and nutrition** and **Me, account and settings**, while preserving visible labels. The active destination exposes `aria-current="page"`, including Home/Coach subroutes. Decorative icons remain hidden from assistive technology. Navigation targets are at least 48px, labels use 0.75rem with natural height, and native system scale 1.5+ triggers a three-column/two-row layout. The height override intentionally outranks legacy fixed-height Coach theme rules, which otherwise clipped large labels. Keyboard focus remains visible.

Coarse-pointer controls get a 48px minimum without changing fine-pointer density. The minimum declarations intentionally override older compact control rules; day grids wrap to preserve target size on narrow screens. Checkbox/radio visuals retain their labeled controls rather than turning every indicator into a 48px square.

Expo now reads system fontScale: Android textZoom follows it; iOS receives text-size-adjust. The safe-area script also publishes large-text state, and reinjection on settings/inset updates avoids reloading the WebView or losing in-progress work. Native Text retains default scaling. The connection error screen scrolls, the URL input has an accessible label/hint, and camera-facing/backend-retry controls have 48dp minimums.

Validation:

- Dedicated Chromium browser test passed across 320×568, 390×844, 844×390 and 768×1024, at 100%/200% navigation text. Checks cover complete on-screen button bounds, no label clipping, no horizontal overflow, explicit names/current state, 48px nav/day controls, and synthesized touch navigation to account.
- Screenshots visually inspected at 320px/200%; large text reflows instead of clipping. Evidence: `artifacts/mobile-accessibility/`.
- Existing cache/navigation browser suite: 8/8, including all main-tab transitions without document reload. Evidence: `artifacts/mobile-accessibility-regression/`.
- Frontend Node suite passed (116 tests); mobile Node suite passed (including two new host accessibility guards). Mobile TypeScript and frontend production build passed.
- Independent review identified low-specificity target minima; corrected so compact class rules cannot defeat the touch floor. Test coverage includes real seven-day controls.

No dependencies, commit or push. Browser checks emulate touch on Chromium; they are not physical-device gesture or screen-reader evidence. iOS Dynamic Type/WebKit text adjustment, Android system text settings, VoiceOver/TalkBack, native fallback scrolling and physical camera overlay geometry still require device checks. No deployed backend/database test was needed or claimed.
