# PhysiqueQuest Mobile Dashboard Redesign

## Goal

Rebuild the signed-in Home and Me visual experience so it closely follows the supplied eight mobile reference screens while leaving routes, React state, callbacks, persistence, authentication, and backend integration unchanged.

## Scope

The redesign covers the Home dashboard, Goals & milestones, Progress, Notifications, Me root settings, and Me secondary settings. It also establishes the shared visual treatment needed for the persistent five-tab navigation displayed on Home and Me roots.

Coach, Scan, Quests, authentication, calibration, API clients, and backend projects are out of scope except for shared CSS rules that make their existing controls continue to render safely.

## Visual Direction

The interface is a compact, white fitness journal framed by dark navy typography and a single optimistic mint accent. The resulting screens should feel organized and calm: thin separators, quiet pale-green feature surfaces, small dense metadata, and strong vertical rhythm rather than decoration or large shadows.

### Tokens

Use the existing design-system custom properties only:

- `--ink` (`#192233`) for titles, navigation icons, and primary content.
- `--muted` (`#627087`) for timestamps, descriptions, and supporting values.
- `--bg` (`#f4f6f3`) and `--soft` (`#f4f7f4`) for quiet backgrounds.
- `--surface` (`#fff`) and `--line` (`#e8ede9`) for cards and separators.
- `--green` (`#7ee582`) for selected controls, progress, CTA surfaces, and success states.
- `--green-dark` (`#167336`) for action labels on pale or green surfaces.

Use the existing system font stack. Headings are compact semibold/700; labels and values are dense but readable; supporting text uses `--muted` and remains at least 10px on phone layouts.

### Layout

Root screens retain the fixed five-item bottom navigation. Detail screens use a compact title row with a back affordance and hide that navigation, unless their current interaction model deliberately keeps the root tab bar visible. Content is mobile-first, centered with the existing content frame, safely clear of device insets, and scrolls beneath a stable footer.

Phone reference layout:

```
╭──────────────────────────────╮
│ compact header / page title   │
│                              │
│ scrollable metrics & lists    │
│  pale-green highlight cards   │
│  white rows + hairline rules  │
│                              │
├──────────────────────────────┤
│ Home  Coach  Scan  Quests  Me │
╰──────────────────────────────╯
```

Cards use a 10–14px radius and near-flat elevation. Rows use separators and a 44px minimum interaction target. Avoid gradients, external fonts, big shadows, new icon packages, or ornamental artwork.

## Screen Contracts

### Home Dashboard

- Render avatar, greeting, compact week metadata, and a notification button with unread dot.
- Use a pale-green Today’s session card with duration, workout title, metadata, full-width mint Start workout button, and secondary plan action.
- Render three evenly divided stats with vertical separators and a small level progress bar.
- Render daily-mission rows with counts and thin mint progress tracks.
- Render the nutrition summary as a bordered module with circular calories and three macro bars.
- Render two journey rows (Goals & milestones, Progress) with icon tiles, title, summary, and chevron.

### Goals & Milestones

- Present the primary goal in a pale-green card with percentage, weight values, progress track, and target date.
- Show milestones as a vertical connected timeline with complete, active, and upcoming states.
- Keep secondary goals in compact rows with percentage badges and progress indicators.

### Progress

- Use segmented pills for Weight, Waist, and Bench press.
- Show the selected metric as a large value plus positive delta and a minimal eight-week vertical-bar chart.
- List personal records with small success/trophy tiles, date, and value.
- In the secondary progress state, present form-accuracy data as a pale quiet module and recent session rows with scores and chevrons.

### Notifications

- Use a compact title row with a Mark all read text action.
- Pin safety content in a pale-red outlined alert that contains its description and Review session action.
- Group notifications into Today and Earlier. Each row includes a small semantic icon tile, title, description, timestamp, and unread dot when appropriate.

### Me & Settings

- Render profile summary with avatar, name/level metadata, and Edit affordance.
- Organize Profile, Safety, Privacy, and Admin tools as labeled groups of separator-based settings rows.
- Support existing toggles and settings choices using mint selected states.
- Place a bordered red Log out action at the bottom of the settings detail screen.
- Keep the Me tab visibly selected in the shared bottom navigation.

## Interaction and Data Boundaries

- Preserve all existing components’ props, callbacks, local state, page routes, and API calls.
- Keep all existing labels, demo data, actions, and navigation targets unless a visual-only text alignment requires a presentation wrapper.
- Do not change backend, API client, authentication, local storage, schemas, request timing, or business rules.
- Do not introduce dependencies. Reuse `Icon` from `frontend/sections/Home/icons.tsx`.

## Responsiveness and Accessibility

- Test 320–380px, 390px, 700px, and 1024px widths; avoid horizontal scrolling at every size.
- Keep interactive targets at least 44px square, including icon-only actions.
- Preserve visible focus rings, semantic button elements, and accessible labels.
- Honor the project’s reduced-motion rules.
- Use `clamp()` for mobile-to-desktop spacing and type where layout requires scaling; do not shrink controls below readable sizes to force a reference-like composition.

## Verification

- Run TypeScript/Next production build from `frontend` after the styling pass.
- Inspect every affected screen at phone width and ensure the page content clears the bottom navigation and safe areas.
- Confirm all current actions still fire their existing callbacks and navigation still reaches the current views.
