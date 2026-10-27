---
name: PhysiqueQuest Design System
description: Modern, appealing fitness tools with clear controls and easy navigation.
colors:
  progress-green: "#22c55e"
  progress-hover: "#4ade80"
  progress-tint: "#143b26"
  night: "#0b0f15"
  night-panel: "#161d27"
  night-raised: "#212b3b"
  steel-border: "#273444"
  steel: "#94a3b8"
  steel-muted: "#64748b"
  text: "#f8fafc"
  warning-coral: "#f87171"
  warning-field: "#480909"
  focus-halo: "#4ade8065"
typography:
  launch-title:
    fontFamily: "Inter, sans-serif"
    fontSize: "29px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-1px"
  auth-heading:
    fontFamily: "Inter, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.9px"
  workout-title:
    fontFamily: "Inter, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.6px"
  page-title:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  action:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  supporting:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  navigation:
    fontFamily: "Inter, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  field: "12px"
  action: "14px"
  panel: "16px"
  workout: "23px"
  level: "24px"
  pill: "999px"
spacing:
  filter-gap: "7px"
  field-padding: "14px"
  content-gutter: "20px"
  section-gap: "26px"
components:
  button-primary:
    backgroundColor: "{colors.progress-green}"
    textColor: "{colors.night}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    height: "54px"
    padding: "0px 16px"
  button-primary-hover:
    backgroundColor: "{colors.progress-hover}"
    textColor: "{colors.night}"
  button-secondary:
    backgroundColor: "{colors.night-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.action}"
    height: "54px"
  input:
    backgroundColor: "{colors.night-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    height: "47px"
    padding: "0px 14px"
  chip:
    backgroundColor: "{colors.night-panel}"
    textColor: "{colors.steel}"
    rounded: "{rounded.pill}"
    padding: "0px 11px"
  workout-card:
    backgroundColor: "{colors.progress-tint}"
    textColor: "{colors.text}"
    rounded: "{rounded.workout}"
    padding: "20px 19px 12px"
  navigation:
    backgroundColor: "{colors.night-panel}"
    textColor: "{colors.steel}"
    height: "74px"
    padding: "6px 10px 10px"
---

# PhysiqueQuest Design System

## Overview

PhysiqueQuest should feel modern, aesthetic, appealing, and easy to use, access, and navigate. The existing interface expresses this through dark surfaces, green actions, compact information groups, rounded controls, and familiar five-tab navigation. Depth is primarily tonal; controls are rounded and restrained.

This is a documentation companion for both `frontend/` and `mobile/`, extracted on October 20, 2026. The detailed governing guide remains [.agents/rules/DESIGN.md](.agents/rules/DESIGN.md), together with [GENERAL.md](.agents/rules/GENERAL.md) and [PROCEDURES.md](.agents/rules/PROCEDURES.md). Preserve its approved screen-specific exceptions. This file does not replace or rewrite that guide. The palette snapshot above comes from `frontend/app/theme.css`; update documentation alongside future intentional token changes.

The current interface runs in Next.js and an Expo WebView. [PRODUCT.md](PRODUCT.md) records the intended native Android/iOS direction; these extracted web dimensions are not a completed native component specification. No metaphor or new visual identity is introduced.

**Key Characteristics:**

- Dark appearance independent of the operating system theme.
- Progress Green for actions, selection, and progress.
- Night surfaces, Steel metadata, and Warning Coral feedback.
- Compact, readable groups with accessible controls and predictable navigation.

Evidence: source inspection of the root layout, theme, scoped styles, navigation, and mobile host; browser inspection of the rendered launch screen. Authenticated screens were inspected in source, not exercised with a live account. Historical screenshots are not treated as current palette evidence. The layout imports `globals.css`, then `theme.css`, then `scrollbars.css`.

## Colors

The approved palette combines Night and Steel neutrals with a single green action accent and coral semantic feedback. Frontmatter is the extracted token reference; runtime CSS remains the implementation source.

### Primary

- **Progress Green** (`--green`, `--green-dark`, `--green-alt`): primary actions, selected controls, progress fills, and links.
- **Progress Hover**: brighter hover and focus treatment.
- **Progress Tint** (`--green-light`): workout, coaching-tip, and level panels.

### Neutral

- **Night** (`--surface`, `--bg`): page canvas and text/icons on green or coral action fills.
- **Night Panel** (`--soft`, `--bg-secondary`): cards, inputs, inactive controls, and footers.
- **Night Raised** (`--bg-tertiary`): elevated or hovered secondary surfaces.
- **Steel Border** (`--line`): separators, borders, progress tracks, and disabled fills.
- **Steel** (`--muted`, `--text-secondary`): secondary information and inactive navigation labels.
- **Muted Steel** (`--gray-mid`): nonessential hints and disabled labels.
- **Primary Text** (`--ink`): main content and icons.

### Semantic feedback

- **Warning Coral** (`--red-dark`, `--red-line`, `--orange-mid`, `--orange-dark`): errors, warnings, required markers, and destructive actions, paired with meaningful text or icons.
- **Warning Field** (`--red-light`, `--orange-light`): warning and emergency backgrounds.
- **Focus Halo** (`--focus-ring`): translucent focus treatment; solid focus uses Progress Green or Progress Hover according to scope.

**The Single Palette Rule.** Reuse the shared dark CSS tokens. Legacy orange, blue, and gray token names are aliases, not permission to restore their old light values. Photography, logos, GIFs, and camera video retain their own colors. The separately approved OTP email palette is outside this app palette.

## Typography

Use Title Case for displayed exercise and food names and for short navigation or section labels where appropriate. Preserve abbreviations, mixed-case brand names, units, personal names, user-entered values, and the exact underlying saved data. Keep explanatory sentences and messages in sentence case. Apply name formatting at display time so editing and API records retain their original text.

Bundled Inter (`frontend/public/fonts/Inter-Variable.ttf`, weights 100–900, `font-display: swap`) is used by the current scoped reference screens. The global fallback is `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`. The mobile host uses native system text.

The extracted roles above are representative, not a new universal scale: launch title, authentication heading, workout title, nested page title, coaching-tip body, primary action, supporting metadata, and Home navigation. Existing scopes vary: account headers use weight 550, Home greetings use 650, and Scan metrics use tabular numerals. At viewport heights up to 800px, the launch title becomes 24px and its subtitle 12px; account actions become 44px tall.

**The Preserve Hierarchy Rule.** Use the owning screen's existing type rules. Do not replace all titles with the largest generic heading rule or introduce additional fonts. Current scoped declarations take precedence over the older broad tables in the detailed guide; several older examples still show superseded muted colors or system-font-only instructions.

## Layout

Main reference screens use a centered mobile frame with a maximum width of 440px, typically 20px horizontal gutters. Launch uses 24px horizontal padding. Home content uses 18px top and 28px bottom padding. Narrow-screen scopes reduce gutters to 14px below 360px. Older generic layouts retain fluid gutters and wider tablet/desktop frames; do not turn those historical values into a universal width requirement.

Use a flex-column shell with one primary scrolling content region, `min-height: 0`, and navigation/footer outside that region. Home navigation is 74px tall; its selected icon sits in a 52-by-29px pill. Place Coach’s Start action at the end of its scrolling content, with space for the floating assistant. Launch is intentionally non-scrollable (`overflow: clip`); short-height rules keep readiness and account actions in view.

Preserve the safe-area aliases backed by native `--safe-*` properties and `env(safe-area-inset-*)`, applying each inset once. Source inspection found one `--sat` definition; the older guide's warning about a later duplicate is historical. Keep controls clear of cutouts, keyboard, and system navigation. Existing responsive thresholds include 359px, 390px, 700px, 740px height, and the launch-specific 800px height rule. These are scope-dependent, not a new breakpoint system.

## Elevation & Depth

Depth primarily comes from Night, Night Panel, Night Raised, and thin Steel borders. The current Home workout card, stats, Coach tip, and Home navigation explicitly remove shadows. Legacy shadow utilities remain available, including `0 1px 3px rgba(25,34,51,0.06)`; document them as existing exceptions rather than adding shadows to flat reference screens.

Verification dialogs keep the complete email address visible by wrapping long addresses, and fit all six code fields without horizontal scrolling. Use the shared modal colors and preserve the resend countdown and keyboard navigation on narrow screens.

**The Tonal Depth Rule.** Preserve flat reference surfaces and use their existing tonal hierarchy. Shared dark modal backdrops use `rgb(0 0 0 / 70%)`; camera overlays may use translucent slate over video. Keep existing modal focus containment, dismissal, focus restoration, and layering.

## Shapes

Fields use gently rounded corners, primary actions use fuller rounded rectangles, and filters/navigation selection use pills. Workout and level panels have larger corners. Circular avatars, status dots, and progress rings remain distinct from rounded rectangular controls. The frontmatter records recurring measured radii without forcing every screen into one radius.

## Components

### Buttons

Primary buttons use Progress Green with Night text. Authentication and Coach actions commonly use the extracted 54px height and 14px corners, with 15px/600 text. Launch short-height actions are 44px. Secondary actions use Night Panel, Primary Text, and a Steel border; hover uses Night Raised. Disabled scoped actions use Steel Border and Steel text. Existing base styles retain brightness/translation/press treatments; do not apply them indiscriminately to scopes that override them.

### Inputs / Fields

Auth forms submit with Enter, expose required fields and pending state, and retain entered values after failure. Recovery and auth outcomes use native modal dialogs, keeping background controls inert. Recovery supports Escape and restores its opener; the account-created outcome retains its explicit calibration action. Registration policy links open clearly marked, empty draft pages in new tabs pending team review.

Authentication/calibration fields use Night Panel, a thin Steel border, 12px corners, 47px height, and 14px horizontal padding. Input text is 15px; focus-within changes the border to green. Preserve visible focus, associated labels, password visibility, unit selectors, validation, and save/retry behavior. Native connection recovery uses its existing system type, scalable sizing, and rounded input/button styles.

### Chips

Library filters use pill shapes, 7px gaps, 11px text, and 32px visible inner spans. Inactive filters use Night Panel and Steel; selected filters use Progress Green and Night. The 32px visual span is not a universal touch-target recommendation: retain or enlarge the surrounding hit area to satisfy the guide's 44px control requirement. Native Android targets should follow the 48dp requirement recorded in PRODUCT.md.

### Cards / Containers

The Home workout panel uses Progress Tint, 23px corners, and `20px 19px 12px` padding. Coaching tips use a 16px radius and `17px 16px` padding. Quest level panels use a 24px radius and 22px padding. Lists and mission rows may remain transparent with separators; do not wrap every row in an additional card.

### Navigation

Keep Home, Coach, Scan, Quests, and Me, with shared SVG icons and visible labels. Active icons receive a green pill; active labels use Primary Text and inactive labels Steel. Signed-in transitions use the client router. Back controls precede nested titles. Preserve the guide's explicit tab-visibility exceptions for the library, Today's Log, Food History, and notifications; do not impose one blanket rule on all nested screens.

### Progress and feedback

Food History uses the reference's unboxed vertical layout: period pills, a prominent daily average, a compact daily bar chart with a target line, macro tracks, and expandable dated records. Use muted green bars, bright green for the latest day, and a warm accent for days above target. Show every day in longer periods while reducing date labels to fit. Adapt the chart and tracks to the dark palette, retain readable labels and 44px filter targets, and keep the shared bottom navigation and back control.

Manual workout logging uses numbered expandable exercise cards with compact set rows, a weight-unit selector, and adjustable rest durations. Saved loads remain in kilograms on the server; the displayed unit and unsaved entries follow the selected unit. Keep existing workout recovery, save feedback, and safety controls available; the manual view does not display the camera preview.

The signed-in assistant entry is a floating circular PhysiqueQuest logo above the bottom controls. Its dark bottom sheet uses the shared palette, a compact coach header, a scrollable conversation area, and a composer. Explain that messages and relevant account summaries are sent to Gemini. Use a native dialog for keyboard focus and dismissal.

Account settings provides a Change photo action and a dark bottom sheet with preview, library and camera choices, removal, and explicit save or cancel. Crop selected photos to a square and keep the existing account settings and navigation.

Leaderboard uses a segmented Quests/Strength selector, period or lift filters, a three-place podium, compact ranking rows and a highlighted personal rank. Strength rankings use self-reported completed sets, clearly label estimated one-rep maximum and bodyweight-relative scores, and never present them as verified lifts or sample standings.

Quests uses a green-tinted level and streak panel, compact divided mission rows, and a four-column badge grid in the shared dark theme. Display missions, personal records, badges and streak information derived from account records; do not invent freeze or penalty data from a mockup.

An empty nutrition account starts with its own zero-state data and normal API-backed logging. **View sample nutrition** explicitly enters a labeled sample experience; **Start my log** returns to real logging. Sample actions remain local. Real photo selection exits sample mode. Neither an empty response nor a failed request silently selects demonstration data.

Mission/macro tracks are commonly 5px high with rounded ends, Steel tracks, and green fills. Calorie rings reuse the shared CalorieProgress component. Display the user's returned values, not screenshot examples. Retain visible cache/connection notices and Retry controls; cold-load placeholders remain quiet and accessible. Sample previews must remain explicitly labeled and must not mask API failures.

### Motion and accessibility

Existing state transitions commonly use 150–300ms timing; generic screen entry uses 280ms with a small vertical movement, while restored launch/auth/Home scopes suppress entry animation. Respect reduced motion. Use the shared icon registry, accessible control names, visible keyboard focus, and the guide's minimum 44px hit areas. These are requirements, not a claim that every existing small control already passes an accessibility audit.

## Do's and Don'ts

### Do:

- **Do** use the shared dark palette and existing CSS custom properties.
- **Do** preserve screen-specific geometry, type, controls, and navigation unless a redesign explicitly changes them.
- **Do** keep clear labels, visible focus, safe-area spacing, and accessible touch areas.
- **Do** retain real loading, empty, cached, failure, and retry states.
- **Do** keep layout/component styles in globals.css, shared colors in theme.css, and scrollbar utilities in scrollbars.css.

### Don't:

- **Don't** restore old light-theme colors or introduce a second competing palette.
- **Don't** hide Back, Clear, Close, edit, or completion controls to match a screenshot.
- **Don't** invent user data, coaching results, delivery success, or competitive penalties from reference artwork.
- **Don't** introduce a UI kit, icon package, font, or parallel stylesheet without the required scope and approval.
- **Don't** describe this web snapshot as a completed native Android/iOS design system.
