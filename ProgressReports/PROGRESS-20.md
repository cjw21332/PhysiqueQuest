# Progress Report 20 — Standalone Goals and Progress Screens

**Scope:** Match the supplied Goals & Milestones and Progress mobile references, move both screens to routes independent of Home, and trim extra top/bottom spacing across signed-in screens  
**Status:** Implemented; frontend production build, TypeScript check, diagnostics, and all frontend tests passed.

## Summary

Goals & Milestones and Progress are now independent authenticated routes at `/goals` and `/progress`. Home dashboard cards navigate directly to these pages. Both pages share the existing bottom navigation and visual system, while retaining API-backed measurements and workout history.

## Behavior updated

- Goals shows live profile goals, target weight, saved weigh-ins, and completed workouts for its circular weekly training-goal indicator.
- A sample milestone plan appears only when the milestone data is not available and the measurement request succeeds; the UI identifies it as sample content. API errors remain visible without sample fallbacks.
- Progress retains API-backed measurement selection, history, add/delete actions, saved workout sessions, and record loads from completed workout results.
- The supplied personal-record, recent-session, and form-accuracy examples fill gaps where the backend does not yet provide those insights; sample content is explicitly labeled.
- Goals and Progress have separate authenticated pages and use the shared bottom navigation. The Home dashboard links to the new routes.
- Signed-in screens use compact content spacing; the app shell still applies device safe-area insets, and the bottom navigation retains touch-sized controls.
- The Secondary goals indicator is a circular progress ring rather than a square badge.

## Files and system areas updated

- New route pages: [goals/page.tsx](../frontend/app/%28app%29/goals/page.tsx) and [progress/page.tsx](../frontend/app/%28app%29/progress/page.tsx).
- Shared route shell: [JourneyPageShell.tsx](../frontend/sections/Home/JourneyPageShell.tsx).
- Goals, Progress, dashboard routing, and bottom-tab state: [GoalsMilestones.tsx](../frontend/sections/Home/GoalsMilestones.tsx), [Progress.tsx](../frontend/sections/Home/Progress.tsx), [HomeDashboard.tsx](../frontend/sections/Home/HomeDashboard.tsx), [HomeSection.tsx](../frontend/sections/Home/HomeSection.tsx), and [BottomNav.tsx](../frontend/sections/Home/BottomNav.tsx).
- Responsive spacing and visual refinements: [globals.css](../frontend/app/globals.css).
- Regression coverage: [standalone-journey-pages.test.mjs](../frontend/tests/standalone-journey-pages.test.mjs), [progress-flow.test.mjs](../frontend/tests/progress-flow.test.mjs), [home-dashboard.test.mjs](../frontend/tests/home-dashboard.test.mjs), and [mobile-redesign.test.mjs](../frontend/tests/mobile-redesign.test.mjs).

## Verification

| Check | Result |
|---|---|
| Frontend production build and TypeScript check | Passed; `/goals` and `/progress` included in the generated route list. |
| Frontend Node test suite | Passed: 59/59 tests. |
| Pylance/TypeScript editor diagnostics on changed TSX files | No errors found. |
| Patch whitespace check (`git diff --check`) | Passed. |
| Authenticated browser screenshot review | Not completed: the available browser session was signed out and the attempted local preview did not finish loading. |
