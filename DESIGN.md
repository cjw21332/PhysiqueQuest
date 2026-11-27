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
  accent-teal: "#2dd4bf"
  accent-teal-tint: "#0b302d"
  accent-amber: "#fbbf24"
  accent-amber-tint: "#3b2914"
  accent-violet: "#a78bfa"
  accent-violet-tint: "#2a2148"
  accent-sky: "#38bdf8"
  accent-sky-tint: "#0c2a3a"
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

The current interface runs in Next.js and an Expo WebView. [PRODUCT.md](PRODUCT.md) records the intended native Android/iOS direction; these extracted web dimensions are not a completed native component specification. No metaphor or new visual identity is introduced. The v1.6.3 state-by-state audit (online and offline) is in [docs/ui-ux-audit-v1.6.3.md](docs/ui-ux-audit-v1.6.3.md).

**Key Characteristics:**

- Dark appearance independent of the operating system theme.
- Progress Green for actions, selection, and progress.
- Four meaning-bound accents (teal, amber, violet, sky) that colour-code nutrition data, mainly in Scan.
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

### Accents (v1.6.3)

Each accent pairs a bright tone (text, bars, icons, dots) with a dark tint (tile and chip backgrounds), declared in `theme.css` as `--teal`/`--teal-tint`, `--amber`/`--amber-tint` (aliases of `--orange-mid`/`--orange-light`), `--violet`/`--violet-tint` and `--sky`/`--sky-tint`. An accent always carries the same meaning:

| Accent | Meaning |
|---|---|
| Progress Green | calories, primary actions, selection, sustainability (food carbon) |
| Teal | protein; lunch; recent-food chips; "fits your profile" tags; training preference; Phiq data access when on |
| Amber | carbohydrates; breakfast; days above target; limited evidence; selected rating stars |
| Violet | fats; dinner; supplements; own exercises and security in Me; the Quests journal and epic badges |
| Sky | water and hydration; snacks; history; upload; moderate evidence; profile; links inside Phiq |

Accents label data. They never replace Progress Green for primary actions (the one exception is Sky for the Add glass action inside the water card), and they are never the only cue: text labels stay beside every colour dot or bar. Gradients are limited to green-to-mint (`#22c55e` to `#4ade80`) for the Scan call to action and a faint accent wash at the top of Scan cards.

### Semantic feedback

- **Warning Coral** (`--red-dark`, `--red-line`, `--orange-mid`, `--orange-dark`): errors, warnings, required markers, and destructive actions, paired with meaningful text or icons.
- **Warning Field** (`--red-light`, `--orange-light`): warning and emergency backgrounds.
- **Focus Halo** (`--focus-ring`): translucent focus treatment; solid focus uses Progress Green or Progress Hover according to scope.

**The Single Palette Rule.** Reuse the shared dark CSS tokens, including the four accents above with their documented meanings; add a new colour only by adding a token here, in `theme.css`, and in the browser palette check (`tests/browser/theme-layout-helpers.mjs`). Legacy orange, blue, and gray token names are aliases, not permission to restore their old light values. Photography, logos, GIFs, camera video and badge crest artwork (`.badge-crest`: metal and enamel illustration) retain their own colors; the browser palette check skips them. The separately approved OTP email palette is outside this app palette.

## Typography

Use Title Case for displayed exercise and food names and for short navigation or section labels where appropriate. Preserve abbreviations, mixed-case brand names, units, personal names, user-entered values, and the exact underlying saved data. Keep explanatory sentences and messages in sentence case. Apply name formatting at display time so editing and API records retain their original text.

Bundled Inter (`frontend/public/fonts/Inter-Variable.ttf`, weights 100–900, `font-display: swap`) is used by the current scoped reference screens. The global fallback is `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`. The mobile host uses native system text.

The extracted roles above are representative, not a new universal scale: launch title, authentication heading, workout title, nested page title, coaching-tip body, primary action, supporting metadata, and Home navigation. Existing scopes vary: account headers use weight 550, Home greetings use 650, and Scan metrics use tabular numerals. At viewport heights up to 800px, the launch title becomes 24px and its subtitle 12px; account actions become 44px tall.

**The Preserve Hierarchy Rule.** Use the owning screen's existing type rules. Do not replace all titles with the largest generic heading rule or introduce additional fonts. Current scoped declarations take precedence over the older broad tables in the detailed guide; several older examples still show superseded muted colors or system-font-only instructions.

## Layout

Main reference screens use a centered mobile frame with a maximum width of 440px, typically 20px horizontal gutters. Launch uses 24px horizontal padding. Home content uses 18px top and 28px bottom padding. Narrow-screen scopes reduce gutters to 14px below 360px. Older generic layouts retain fluid gutters and wider tablet/desktop frames; do not turn those historical values into a universal width requirement.

**Mobile profile editors.** Personal data, Goals, Training preference, Health profile, and other account editors use the same centered, fluid frame, capped at 440px even when the application is shown in a desktop browser. Keep their header, scrolling form, and save/discard footer aligned to that frame. Arrange sections in a single vertical reading order; compact related fields may share a row when they remain legible. On narrow phones reduce gutters before shrinking controls, keep touch targets at least 44px, allow text and chips to wrap, and avoid horizontal scrolling. The footer stays outside the scroll region and respects safe areas. A wide browser is a preview of the mobile application, not a reason to expand these editors into a desktop dashboard.

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

Food History uses the reference's unboxed vertical layout: period pills, a prominent daily average, a compact daily bar chart with a target line, macro tracks, and expandable dated records. Use muted green bars, mint for the latest day, and Amber for days above target. Show every day in longer periods while reducing date labels to fit. Adapt the chart and tracks to the dark palette, retain readable labels and 44px filter targets, and keep the shared bottom navigation and back control.

Manual workout logging uses numbered expandable exercise cards with compact set rows, a weight-unit selector, and adjustable rest durations. Saved loads remain in kilograms on the server; the displayed unit and unsaved entries follow the selected unit. Keep existing workout recovery, save feedback, and safety controls available; the manual view does not display the camera preview.

The signed-in assistant entry is a floating circular PhysiqueQuest logo above the bottom controls. Its dark bottom sheet uses the shared palette, a compact coach header, a scrollable conversation area, and a composer. Explain that messages and relevant account summaries are sent to Gemini. Use a native dialog for keyboard focus and dismissal.

**Phiq (v1.6.3).** The launcher is a green-to-mint circle with a Night ring and a Sky status dot. The sheet has 26px top corners; its header carries a faint green wash, a gradient avatar with a Progress Tint halo, a mint eyebrow and a mint "online" dot, and Clear chat is a pill. The welcome card repeats the wash and a gradient icon tile; suggested questions are full-width 52px rows whose icon tiles are Sky (explain this page), Amber (explore features) and Violet (my data access). Your messages are green-to-mint bubbles with Night text; Phiq's are Night Panel bubbles with a Steel border. Waiting shows a pulsing mint dot next to the "Phiq is thinking" status; errors sit in a coral-tinted card with Try again. The data-access card turns Teal (border, tint, On pill) when access is on. The send button uses the green-to-mint gradient when enabled.

Account settings provides a Change photo action and a dark bottom sheet with preview, library and camera choices, removal, and explicit save or cancel. Crop selected photos to a square and keep the existing account settings and navigation.

**Me (v1.6.3).** The profile summary is a green-washed card with a mint-ringed avatar, a mint level line, a Sky Change photo link and a green pill Edit action. Group titles are 12px uppercase Steel (Safety in Coral). Each group is one rounded Night Panel card with divided 64px rows; a row's 40px icon tile and chevron take its accent (profile Sky, goals and feedback Amber, training Teal, health Green, own exercises and security Violet, emergency contact Coral). Setting blocks sit in matching cards; the selected inactivity threshold is Progress Green; Log out is a coral-tinted button. Me editors keep their form, with a Sky information note, Amber offline note, soft group cards, tile-style condition checkboxes that turn Progress Tint when checked, a coral error panel and the green-to-mint save action. Send feedback uses 48px rating tiles that turn Amber when chosen and a "Send feedback" action.

Leaderboard uses a segmented Quests/Strength selector, period or lift filters, a three-place podium, compact ranking rows and a highlighted personal rank. Strength rankings use self-reported completed sets, clearly label estimated one-rep maximum and bodyweight-relative scores, and never present them as verified lifts or sample standings.

Quests uses a green-tinted level and streak panel, compact divided mission rows, and a four-column badge grid in the shared dark theme. Display missions, personal records, badges and streak information derived from account records; do not invent freeze or penalty data from a mockup. Personal quests are labelled by slot, not by difficulty: Quest 1 (record), Quest 2 (routine), Quest 3 (volume); a finished quest is replaced in the same slot and keeps its label, with difficulty shown as "Level N". The journal's Violet "View all" link opens Personal quests (`/quests/personal`): Violet summary tiles (finished, in progress, XP), the current quests, and finished quests newest first (latest 100 kept).

An empty nutrition account starts with its own zero-state data and normal API-backed logging. **View sample nutrition** explicitly enters a labeled sample experience; **Start my log** returns to real logging. Sample actions remain local. Real photo selection exits sample mode. Neither an empty response nor a failed request silently selects demonstration data.

My Dietary Plan uses the Scan shell and bottom navigation. Its segmented views show the active targets, editable goals and macro split, and a four-meal allocation. Use Night surfaces, green selection and actions, and Steel metadata. Display estimates and recorded meal totals as such; do not invent audit scores, progress, or phase end dates. AI recommendations are reviewed before saving and explain which profile data is sent to the provider.

Mission/macro tracks are commonly 5px high with rounded ends, Steel tracks, and green fills. Scan macro tracks are 6px and use the macro accent (protein teal, carbs amber, fats violet) over a faint tint of the same accent, with a matching dot beside each label.

**Scan (v1.6.3).** Scan cards (today summary, water, food carbon, dietary plan, history summary) use 22px corners, a Steel border and a faint accent wash fading into Night Panel. Meal diary cards take their meal accent on the icon tile, Add button, chevron and open border. The Scan your meal action is the green-to-mint gradient with a Night icon tile. The dietary plan's macro split bar, legend and macro tiles use the macro accents; local food ideas are a list of rows with an accent left edge and uppercase accent labels, and supplement advice sits in a violet callout. Calorie rings reuse the shared CalorieProgress component. Display the user's returned values, not screenshot examples. Retain visible cache/connection notices and Retry controls; cold-load placeholders remain quiet and accessible. Sample previews must remain explicitly labeled and must not mask API failures.

### Motion and accessibility

Existing state transitions commonly use 150–300ms timing; generic screen entry uses 280ms with a small vertical movement, while restored launch/auth/Home scopes suppress entry animation. Respect reduced motion. Use the shared icon registry, accessible control names, visible keyboard focus, and the guide's minimum 44px hit areas.

**Network, session and permission states.** One toast at a time from the app shell, in priority order: connected, back online, sign in to sync (session expired), offline (with Try again and Continue offline), slow connection, then reconnecting. "Slow connection" appears when any API request (except chat and photo scans, which show their own progress) runs past 6 seconds, says nothing entered is lost, and clears itself when requests finish. Framework 401/403 responses read "Your session expired. Sign in again." and "You don't have permission to do that."; specific server messages are shown as written. Denied camera access never blocks manual logging; denied notifications explain how to enable them; denied location still sends emergency alerts without a location.

**One highlight per control.** A field shows exactly one focus indicator: its own green border, or, for composite fields (`.input-wrap`, search bars), the wrapper's green border while inner controls keep their normal border. Do not add focus halos (`box-shadow` rings) on top of a green border. Focus outlines appear only during keyboard navigation: `InputModality` sets `html[data-keyboard]` on Tab or arrow keys and clears it on any tap or click, and `:root:not([data-keyboard]) :focus-visible` removes the ring after taps. These are requirements, not a claim that every existing small control already passes an accessibility audit.

## App icon

The launcher icon is the round logo on white (the logo's own ring colour), never on black. Android adaptive icons put the logo circle across the 72-unit visible area of the 108-unit canvas on a white background, so circle-shaped launchers show just the round logo; launchers that force their own shape (for example ColorOS rounded squares) show the logo on white. iOS requires an opaque square that the system masks, so it uses the same round logo on white.

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
