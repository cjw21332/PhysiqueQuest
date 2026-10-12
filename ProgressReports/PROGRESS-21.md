# Progress Report 21 — Notifications Reference Design

**Scope:** Match the Home Notifications screen to the supplied reference while preserving API-backed behavior and documenting the active design rules  
**Status:** Implemented; frontend production build and all frontend tests passed.

## Summary

Notifications now presents a pinned safety alert when the API returns an actual safety notification, followed by readable, grouped notification rows. Existing loading, empty, error/retry, mark-read, and mark-all-read behavior remains connected to the notifications API. The safety card uses a truthful “Mark as read” action because the current notification data does not provide a session-review destination.

## Behavior and design updates

- Safety notices are sourced from API notification records; no mock notification records were added.
- Today appears before other groups and Earlier appears last when those groups exist. API-provided item titles, bodies, times, and unread state are preserved.
- Added responsive, component-scoped notification styles in the existing global stylesheet, including unread markers and accessible touch-sized actions.
- Updated the design-system guide with the active frontend constraints and Notifications-specific visual and data rules.

## Files updated

- [Notifications.tsx](../frontend/sections/Home/Notifications.tsx)
- [globals.css](../frontend/app/globals.css)
- [DESIGN.md](../.agents/rules/DESIGN.md)
- [mobile-redesign.test.mjs](../frontend/tests/mobile-redesign.test.mjs)

## Verification

| Check | Result |
|---|---|
| Frontend production build and TypeScript check | Passed. |
| Complete frontend Node test suite | Passed: 66/66 tests. |
| Patch whitespace check (`git diff --check`) | Passed. |
