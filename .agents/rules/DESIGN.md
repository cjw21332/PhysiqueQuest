---
description: PhysiqueQuest visual and responsive design system for the Next.js web app and Expo WebView. Defines the light-theme interface, component library, responsive rules, and extension patterns. The web app is the design source; the Expo app displays it in a native WebView with device capabilities (safe-area insets, camera, file inputs).
---

# PhysiqueQuest Design System (2026-10-14)

This document specifies the current PhysiqueQuest product interface, design tokens, component patterns, responsive behavior, and rules for extending the system consistently. It describes the current codebase rather than asserting a product release version. Update this document when adding new UI patterns or making significant design decisions.

**Mandatory governing rules:** Follow [GENERAL.md](./GENERAL.md) together with this frontend design guide. [PROCEDURES.md](./PROCEDURES.md) governs architecture and engineering workflow; [DATABASE.md](./DATABASE.md) governs backend and persistence.

## 1. Product Architecture & Navigation

### Non-Negotiable System Design Rules
- Keep all frontend styles in `frontend/app/globals.css`; scope new rules to the relevant component instead of creating stylesheets or CSS modules.
- Reuse the established light palette and CSS custom properties. Do not introduce new palette tokens, UI frameworks, component kits, or icon packages without approval.
- Treat the web app as the UI source for both browsers and the Expo WebView. Design mobile-first, account for safe-area insets, and preserve the established 390px, 700px, and 740px responsive breakpoints.
- Use the shared `Icon` registry, existing React state and API-backed persistence patterns, and the established five-tab navigation.
- Keep backend-backed screens truthful: render real API data and explicit loading, empty, and error/retry states. If the user explicitly requests a temporary sample preview, identify it as sample content, use it only after a successful empty response (never mask loading or API errors), and keep sample-only actions local.
- Coach Exercise Library and the explicitly requested Me admin catalog/New exercise/analytics previews use separate local fixtures, never API-error fallbacks. Me opens the admin components with `preview` explicitly enabled; their default API mode and the public library's integration are preserved. Mock admin actions make no provider or persistence writes, and mock data is labeled in the admin screens.
- Preserve accessible names, visible keyboard focus, and 44px minimum touch targets for interactive controls. Respect reduced-motion preferences.

### App Structure
PhysiqueQuest is a mobile-first fitness and nutrition prototype. The Next.js web app provides product UI and behavior; the Expo app hosts it in a native WebView and bridges device capabilities.

**Five Main Sections (Signed-In Users):**
- **Home**: Training dashboard, goals & milestones, progress metrics, and notifications center
- **Coach**: Weekly training plan, exercise library, camera readiness check, live workout session, and post-workout report
- **Scan**: Nutrition overview, meal review, Add Food flow, Today’s Log with water tracking, and Food History
- **Quests**: Level/streak progress, daily missions, earned badges, and leaderboard entry
- **Me**: Profile, safety settings, privacy controls, account settings, and Admin tools (Exercise Library admin, Analytics dashboard)

### Entry Flows & Authentication
- **Root route** (`/`): Server-redirects to `/launch`; signed-in route guards send unauthenticated users to `/launch`
- **Launch** (`/launch`): Prototype entry flow with device readiness checks (camera, permissions)
- **Login** (`/login`): Authentication form
- **Register** (`/register`): Account details and consent → four-step calibration (Personal Data → Goals → Training Preference → Health & Safety) → creates the account/profile through the API and stores the returned session
- **Admin Views**: Exercise Library (search, filters, draft creation) and Analytics (date ranges, retention viz, event summary) — frontend views over live backend endpoints, gated by an admin role

### Navigation Behavior
- **Mock admin entry visibility:** Exercise Library and Engagement analytics appear below Change password in Me for every signed-in account while they open explicit local previews. Backend administrator authorization remains unchanged; exposing these mock links grants no access to live administrator data or writes.
- **Me reference screens:** Account & Settings and its five profile editors use the supplied white surface, green chips/switches, icon rows, quiet input borders, and shared back/title and save/discard layout. Render saved profile/settings values; retain role-gated admin tools and honest alarm-volume wording. Editors preserve saved measurement units, keep failed saves open, and hide the tab bar. Reference avatar artwork is decorative. Sample-profile mode, manual alert testing, and the alert-log menu row were removed at the user's request; profile/settings/security/logout retain API behavior. Only the three requested admin pages display mock data.
- **Nutrition calorie display:** Home Nutrition today, Today's Log, and the Scan overview reuse `Home/CalorieProgress.tsx` and its shared ring sizing/type styles, including the empty track and clamped fill. Edit Meal food names use debounced backend USDA suggestions with loading, empty, and retry states. Selecting a suggestion updates its name/reference; nutrition values remain available for user review rather than being replaced without a portion calculation.
- **Today's Log meal rows:** Show the original input source (Scanned or Manual), an edited marker when applicable, and the original device-local logging time last. Empty meal categories show "No logged yet". Logged food buttons open the shared Scan-themed editor; a multi-food meal offers a food selector. Cancel keeps the existing data, and failed saves remain in the editor for retry.
- **Nested-page headers:** Place the back icon immediately before the page title in both markup and visual order. Keep secondary actions such as History, Retake, and Share at the trailing edge; do not move the back control after the title with CSS ordering.
- **Main tab bar** (five tabs): Positioned above device system-navigation on main section screens (Home, Coach, Scan, Quests, Me)
- **Nested/detail flows**: Usually hide the tab bar to reclaim screen space; Today’s Log is an intentional exception and retains it. Provide a clear back button or completion action to parent. Includes:
  - Home subviews (goals detail, progress, notifications)
  - Coach subviews (camera check, live session, report; Exercise Library retains the main tab bar to match its supplied reference)
  - Scan subviews (meal review and Add Food hide navigation; Today’s Log and Food History retain the main tab bar)
  - Me subviews (Admin tools)
- **Tab bar visibility**: Main section roots, Today’s Log, Food History, and the Coach Exercise Library retain the tab bar; the exercise modal covers navigation while open. Other nested views follow the owning section’s explicit navigation behavior.
- **Content frame**: Home is the reference for signed-in content width and gutters; reuse this centered frame across all sections

### Data & Persistence
- **Authentication and onboarding**: The NestJS API implements registration, login, and profile persistence. The JWT and a non-authoritative profile cache live in localStorage. Repository code does not prove any specific Atlas deployment is reachable.
- **Nutrition, workouts, progress, quests, notifications, settings**: These domains have backend API/model implementations. A screen must still show the actual API state and must not imply live data when a request failed.
- **Local-only**: `physiquequest-recent-foods` stores food suggestions, not the meal log. The app also stores the JWT, profile cache, and optional API URL override in localStorage.
- **Backend**: The NestJS API uses a global `/api` prefix and defaults to port 4000. The Expo WebView loads the web app; the API host is derived from the page's LAN hostname in development.
- **Estimate/demo values**: Meal-photo analysis returns a model/provider estimate and requires user review; it is not a verified measurement. Camera readiness, form scores, workout feedback, local video handling, and the Quests leaderboard preview must be labeled as sample/demo behavior. Backend-backed nutrition, workouts, progress, quests, notifications, settings, and admin analytics should show live responses only when those requests succeed.

### Backend Integration (Design-Relevant)
The web app is the product surface; the NestJS API supplies the data behind it. Design decisions must account for this:

- **Loading, empty, and error states** are part of the UI. Every data-driven surface (Home progress, notifications, Scan nutrition, Quests activity, Me settings, admin views) must show a loading state, an honest empty state, and a retry path on failure — not sample data dressed up as live data.
- **Sample/demo labeling**: label AI form scores, camera readiness, unconfigured pose analysis, and the Quests leaderboard preview as sample/demo behavior. Meal-scan results are provider estimates that require review; do not label a live response as a sample. Surfaces backed by real collections must not be presented as samples.
- **Offline and degraded behavior**: the API may be unreachable (phone off the LAN, backend down). The client may retain a profile cache for presentation, but that cache is not an offline mode or source of truth; show failures and never silently fall back to local writes.
- **Consistency across surfaces**: when the backend returns updated data (a new meal, a completed workout, a saved measurement), the UI should reflect it without a full reload. The app uses custom events (`physiquequest-nutrition-updated`, `physiquequest-profile-updated`) and hook refreshers for this.

## 2. Design Tokens: Color & Typography

### Color Palette

Core colors are CSS custom properties in `frontend/app/globals.css`. Reuse these for all new UI; do not introduce new palette variables without approval.

| Token | Value | Use Case |
|:--|:--|:--|
| `--ink` | #192233 | Primary text, headings, icons, primary interactive elements |
| `--muted` | #627087 | Secondary text, captions, hints, disabled states |
| `--bg` | #f4f6f3 | Page/section backgrounds, subtle fill areas |
| `--surface` | #fff | Main content areas, cards, input fields, control surfaces |
| `--soft` | #f4f7f4 | Quiet/inactive surfaces, subtle fills, unselected controls |
| `--line` | #e8ede9 | Borders, dividers, separators, input focus states |
| `--green` | #7ee582 | Primary actions, progress indicators, success states, selected controls |
| `--green-dark` | #167336 | Text on green surfaces, secondary brand accents, dark mode alternative |
| `--green-light` | #eefaf0 | Tinted green surfaces (brand mark, colored cards) |
| `--green-alt` | #80e687 | Alternate green used in existing components; prefer `--green` for new work |
| `--bg-secondary` | #f4f7f4 | Secondary page fill (same value as `--soft`) |
| `--bg-tertiary` | #f9faf9 | Tertiary fill for subtle layering |
| `--text-secondary` | #344256 | Secondary body text between `--ink` and `--muted` |
| `--focus-ring` | #7ee58265 | Translucent green focus/outline fill |
| `--orange-light` / `--orange-mid` / `--orange-dark` | #fff5e5 / #ed641e / #bc4d13 | Warning surfaces and text |
| `--red-light` / `--red-line` / `--red-dark` | #fff0f0 / #f8d7d7 / #e4433a | Error surfaces, borders, and text |
| `--blue-light` / `--blue-dark` | #f0f9ff / #176a30 | Information surfaces (note: `--blue-dark` holds a green value; treat its name as legacy) |
| `--gray-light` / `--gray-mid` / `--gray-dark` | #f3f6f4 / #8793a1 / #536071 | Neutral utility grays |

These extended tokens are declared in `frontend/app/globals.css` `:root` and are the only palette variables to use. Do not add new palette variables without approval.

**Semantic Colors** (already in stylesheet, use instead of defining new ones):
- Error/danger: `#e53935` / `#bd3030` (red tones)
- Warning: `#b45e15` / `#ed641e` (orange/amber)
- Success: `--green` and `--green-dark`
- Information: Blue tones (use sparingly, not primary brand color)

**Color Usage Rules:**
- Use `--ink` for all primary text and interactive labels
- Use `--muted` to de-emphasize secondary information
- Use `--surface` and `--soft` for depth and layering, never both at same visual level
- Use `--green` for all primary CTAs and progress states
- Status colors (error, warning) must pair with icons or text labels, never color alone
- Avoid using the dark live-workout view (#111827) elsewhere without explicit product approval

### Typography System

**Font Family:**
```css
-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif
```
System fonts only. Do not add web fonts or custom typefaces.

**Type Scale & Weight Hierarchy:**

| Role | Size | Weight | Color | Usage |
|:--|:--|:--|:--|:--|
| Page heading (h1) | `clamp(28px, 5vw, 48px)` | 700 | `--ink` | Section/page titles (Home, Coach, Scan, Quests, Me) |
| Section heading (h2) | `clamp(22px, 4vw, 32px)` | 700 | `--ink` | Major subsection titles, goal cards, hero sections |
| Subsection heading (h3) | `clamp(14px, 2.8vw, 17px)` | 700 | `--ink` | Card titles, mission titles, nested section labels |
| Body copy | `clamp(13px, 2.5vw, 16px)` | 400 | `--ink` | Main content text, descriptions, list items |
| Secondary text | `clamp(12px, 2.4vw, 14px)` | 400 | `--muted` | Captions, subtitles, metadata, helper text |
| Label / badge | `clamp(11px, 1.6vw, 13px)` | 600 | `--ink` | Form labels, button text, chip labels |
| Hint / small | `clamp(10px, 1.4vw, 12px)` | 400 | `--muted` | Inline hints, error messages, timestamp, very small copy |
| Micro / tag | `clamp(9px, 1.3vw, 11px)` | 400 | `--muted` | Tags, badges, mini metadata, icon labels |

**Weight Rules:**
- **700 (semibold)**: Headings, labels, selected states, emphasis
- **600**: Form labels, button text, important metadata
- **400 (regular)**: Body copy, descriptions, secondary information, unselected states

**Responsive Text:** Use `clamp()` for fluid scaling across viewport widths and heights. Do not use fixed breakpoint-based sizes when `clamp()` achieves the same goal more elegantly.

**Calibration Flow Typography Specifications:**

| Element | Font Size | Weight | Color | Usage |
|:--|:--|:--|:--|:--|
| Step indicator | 12px | 400 (regular) | --green-dark (#167336) | "Step 1 of 4 · Calibration" |
| Section heading (h2) | clamp(19px, 5vw, 24px) | 600 (semibold) | --ink (#192233) | "Personal data", "What are you training for?" |
| Description text | clamp(13px, 2.5vw, 16px) | 400 (regular) | --muted (#627087) | Subtitle under section heading |
| Section labels | 14-15px | 600 (semibold) | --ink (#192233) | "Basic information", "Equipment available", "Training days" |
| Field labels | 13-14px | 600 (semibold) | --ink (#192233) | "Age", "Height", "Weight", "Gender" |
| Input text | 14-16px | 400 (regular) | --ink (#192233) | User-entered values |
| Unit suffixes | 11-13px | 400 (regular) | --muted (#627087) | "yrs", "cm", "kg" within inputs |
| Optional labels | 11-12px | 400 (regular) | --muted (#627087) | "Optional" badges |
| Required labels | 11-12px | 400 (regular) | #e53935 (red) | "Required" badges |
| BMI display | 13-14px | 400 (regular) | --muted (#627087) | "BMI 23.2" |
| Button labels (selected) | 14-15px | 600 (semibold) | --green-dark (#167336) | Selected choice buttons |
| Button labels (unselected) | 14-15px | 400 (regular) | --ink (#192233) | Unselected choice buttons |
| Goal card titles | 14-15px | 600 (semibold) | --ink (#192233) | "Weight loss", "Build muscle" |
| Goal card details | 12-13px | 400 (regular) | --muted (#627087) | "Calorie deficit + conditioning" |
| Microcopy/helper text | 12-13px | 400 (regular) | --muted (#627087) | Activity descriptions |
| Primary button text | clamp(14px, 2.5vw, 17px) | 600 (semibold) | --green-dark (#167336) | "Next: Goals →", "Finish & build my plan →" |
| Back button | 13px | 400 (regular) | --muted (#627087) | "Back" in step header |
| Clear button | 12px | 400 (regular) | --muted (#627087) | "Clear" inline section buttons |
| Day buttons | 14-16px | 600 (semibold) when selected | --green-dark or --ink | "M", "T", "W" training day buttons |
| Checkbox labels | 14px | 400 (regular) | --ink (#192233) | Condition checkboxes, equipment options |
| Placeholder text | 13-14px | 400 (regular) | --muted (#627087) | Textarea placeholders |
| Safety note | 12-13px | 400 (regular) | --ink (#192233) | Emergency contact info boxes |
| Password requirements title | 12px | 400 (regular) | --muted (#627087) | "Password must contain:" |
| Password requirements list | 13px | 400 (regular) | --muted (unmet) / --green-dark (met) | Individual password requirements with checkmarks |

**Typography Rules:**
- Use clamp() for responsive text sizing where layouts need to adapt
- Keep headings compact, body text readable, and secondary text legible on small phones
- Typical targets: 18–24px for page headings, 13–16px for body copy, 11–13px for supporting text
- Do not shrink controls or labels below readable sizes to force fit
- Semibold (600) is used for emphasis on labels, headings, and selected states
- Regular (400) is the default weight for body text and unselected states
- Muted color (#627087) distinguishes secondary information from primary content

## 3. Layout, Spacing & Safe Areas

### Content Frame & Gutters

All signed-in content (Home, Coach, Scan, Quests, Me) uses a shared, centered frame to maintain visual consistency across the product.

**Responsive Content Widths:**
- **Narrow phones** (≤ 390px): Full width with reduced horizontal padding (about `15–18px` per side, per the `@media (max-width: 390px)` rules in `globals.css`)
- **Mobile** (391px and up): Full width with the section's own padding
- **Tablet** (700px and up): Centered at `max-width: 800px` in the section containers (Coach, Me, Quests, Scan)
- **Desktop** (1024px and up): Centered at `max-width: 1000px` in the same containers
- **Shared tokens:** `--content-max: 1000px` and `--content-gutter: clamp(16px, 4vw, 40px)` are declared in `globals.css` and used by the shared content frame. Prefer these tokens for new layout work.

**Vertical Spacing:**
Use `clamp()` for responsive vertical spacing tied to viewport height:
- Large sections: `clamp(20px, 4vh, 32px)`
- Medium gaps: `clamp(14px, 2.5vh, 20px)`
- Small gaps: `clamp(8px, 1.5vh, 14px)`

### Safe Area Insets (Device Notches, Home Indicator, System Nav)

The app reserves safe-area insets at all edges. On Expo WebView, native code publishes insets as CSS custom properties:
```css
--sat: var(--safe-top, env(safe-area-inset-top, 0px));
--sab: var(--safe-bottom, env(safe-area-inset-bottom, 0px));
--sal: var(--safe-left, env(safe-area-inset-left, 0px));
--sar: var(--safe-right, env(safe-area-inset-right, 0px));
```
`globals.css` declares these twice: once in the top `:root` block (with the `--safe-*` fallback above) and again in a later `:root` block (around line 878) that uses plain `env()` and also sets `--pad-x`. The later declaration wins for the plain `env()` form, so the `--safe-*` override from native code is ignored there. Treat this duplication as a known issue. Do not add a third declaration; consolidate to the first form when the file is next edited.

The shared `--pad-x` token (`clamp(16px, 4vw, 40px)`) is set in the same later block and widens at tablet and desktop breakpoints (`clamp(24px, 4vw, 48px)` and `clamp(32px, 5vw, 72px)`).

**Safe Area Rules:**
- Apply each inset once per element—do not stack insets on parent and child
- Backgrounds may extend behind system bars, but text, buttons, icons, and interactive content must remain clear
- The main tab bar sits above `--sab` (system navigation); the scroll content sits inside the main container and respects insets within its own flex/grid
- Do not overlap interactive content with status bar (top), notches/cutouts (all edges), or system navigation buttons (bottom)

### Scroll Behavior & Layout Structure

Each section uses a consistent flex-column layout:
```
.section-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.section-header { flex: 0 0 auto; }       /* Fixed height */
.section-content { flex: 1 1 auto; min-height: 0; overflow-y: auto; }  /* Scrollable */
.section-footer { flex: 0 0 auto; }       /* Sticky or fixed */
```

**Scroll Container Best Practices:**
- Keep one primary scroll region per screen when possible
- Use `-webkit-overflow-scrolling: touch` for smooth momentum scrolling on iOS
- Set `overscroll-behavior: contain` to prevent rubber-banding effects
- Do not use sticky positioning for ordinary in-flow actions (e.g., Coach’s Start session); reserve sticky only for form footers or key control bars that genuinely benefit from staying in view
- Ensure final scrollable content has enough trailing space (via padding or margin) so users can scroll it clear of sticky elements

## 4. Responsive Design & Breakpoints

**Mobile-First Approach:** Design and test on narrow portrait phones first, then verify at tablet, landscape, and desktop widths and at various heights (especially short landscape screens like iPhone SE).

**Key Breakpoints & Testing Widths:**
- **Narrow phones**: 320–380px (smallest devices, most constrained)
- **Standard phones**: 380–420px (iPhone 12/13/14/15 portrait)
- **Large phones**: 420–520px (iPhone Plus models, some Android)
- **Landscape phones**: 600–740px height, variable width (short screens need special attention)
- **Tablet**: 700–768px and above (iPad portrait/landscape)
- **Desktop**: 1024px (standard laptop), 1200px+ (wide desktop/external displays)

**Short-Height Screens** (max-height: 520–740px):
- Reduce padding and margins
- Hide non-essential decorative elements
- Prioritize vertical content flow
- Test landscape phone orientations aggressively

**Responsive Units:**
- Use `clamp(min, preferred, max)` for fluid scaling (e.g., `clamp(14px, 2.5vw, 18px)`)
- Prefer viewport-width/height percentages (`vw`, `vh`) over fixed breakpoints where possible
- Use `minmax(0, 1fr)` in grid columns to allow shrinking and prevent overflow
- Use `min-width: 0` on flexible children to allow text truncation

**Grid & Flexbox Best Practices:**
- Flexible cards and lists should wrap naturally, not force horizontal scrolling
- Multi-column grids on desktop should adapt: `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))`
- Touch targets must remain at least 44px × 44px; do not shrink for density on small screens
- Chart and data viz should scale to available width; preserve readability labels

**Landscape Phone Layout:**
Landscape phones (width > height) have limited vertical space. Test these scenarios:
- Tab bar may shift to side on ultra-wide portrait (non-standard, not required)
- Forms and tall content must scroll or adapt to short height
- Live video/camera views should use available landscape space efficiently

## 5. Components & Interaction Patterns

### Button & Control Styles

**Primary Action Button** (`.primary`):
- Background: `var(--green)` (#7ee582)
- Text: `#0d2212` (dark green-black, hard-coded in `.primary`)
- Min height: `clamp(48px, 8vh, 62px)` (touch-safe)
- Border radius: `clamp(10px, 2vw, 15px)`
- Font: `clamp(13px, 2vw, 16px)`, weight 700
- Use for: CTAs, form submission, "Next", "Start Workout", "Save"
- Hover state: `filter: brightness(.96)`, `translateY(-2px)`, green glow shadow
- Active state: `transform: scale(0.96)`
- Disabled: `opacity: 0.6`, no transform or shadow

**Secondary Action Button** (`.secondary`):
- Background: White
- Border: 1px `var(--line)` (#e8ede9)
- Text: `var(--ink)` (#192233)
- Min height: `clamp(48px, 8vh, 62px)`
- Use for: Alternatives, "Cancel", "Back", optional actions
- Hover state: `filter: brightness(.98)`, `translateY(-2px)`, background `#fafbfa`, soft shadow
- Active state: `transform: scale(0.96)`

**Link Button** (text-only):
- Background: transparent
- Text: `var(--green-dark)` (#167336)
- Font weight: 600
- Use for: Navigation, secondary actions, "View All", "Edit"
- Hover state: `opacity: 0.8`

**Input Fields** (`.input-wrap`):
- Border: 1px `var(--line)` (#e8ede9)
- Border radius: `11px`
- Min height: 44px
- Padding: `0 12px`
- Focus state: `.focus-within:focus-within` applies `outline: 2px solid #7ee58265` + `border-color: #70cf75`
- Placeholder: `#a1aaba` (hard-coded in `globals.css`)
- All inputs use system font stack, 13–16px, inherit font properties

**Form Field Labels:**
- Font size: 12–14px
- Font weight: 600
- Margin bottom: 7px
- Color: `var(--ink)` (#192233)
- Required indicator: Red (#d63737), font-weight 600
- Optional label: `var(--muted)`, 11–12px

### Card & Surface Components

**Standard Card** (`.mission-card`, `.journey-card`):
- Background: `var(--surface)` (#fff)
- Border: None (or 1px `var(--line)`)
- Border radius: `clamp(10px, 2vw, 14px)`
- Padding: `clamp(11px, 2.2vw, 16px)`
- Box shadow: `0 1px 3px rgba(25, 34, 51, 0.04)` or `0.06` (subtle depth)
- Hover state: Slight scale (0.98) or shadow lift on interactive cards

**Colored Card** (`.goal-card`, `.level-card`):
- Background: Light tint (e.g., `#effaf0` for green theme)
- Border: 1px light border or none
- Border radius: Same as standard cards
- Use for: Goals, milestones, achievements, themed sections

**Progress Bar** (`.progress-bar-fill`):
- Height: `clamp(5px, 1vh, 7px)`
- Background: `var(--green)` (#7ee582)
- Border radius: `clamp(4px, 0.8vw, 6px)` (match rounded ends)
- Transition: `width 0.3s` (smooth animation)
- Container background: `var(--soft)` or `#eef0ee`

### Icon Usage

**Icon System:**
- Use the shared Icon component in `frontend/sections/Home/icons.tsx`
- Add new icons to the registry before using
- Do not import external icon packages (SVG or font-based)
- All icons inherit the text color of their parent element
- Icon size: Use semantic sizing (small: 16–24px, medium: 24–36px, large: 36–48px)

**Icon Accessibility:**
- Icon-only buttons must have `aria-label` or visible text label
- Decorative icons do not need labels
- Color contrast: Icons must meet WCAG AA standards when used as primary content

### Touch & Focus States

**Minimum Touch Target:** 44px × 44px (iOS standard)
- Buttons, links, form controls, and tappable list items must meet or exceed this
- If visual size is smaller, add padding to expand the hit area

**Focus Visible State:**
```css
.focus-ring:focus-visible {
  outline: 2px solid #7ee582; /* --green */
  outline-offset: 2px;
}
```
- Components also set their own focus outlines; `.eye:focus-visible` and `.input-wrap select:focus-visible` use `#7ee582`, and `.eye-toggle:focus-visible` uses `var(--green-dark)`
- Never remove default focus indicators without providing a replacement
- Focus ring must be visible on all interactive elements

**Active/Pressed State:**
- Slight scale down: `transform: scale(0.98)`
- Slight background/shadow change (do not rely on color alone)
- Accessible to keyboard and touch

## 6. Motion, Animations & Accessibility

### Motion Principles

**Reduce Motion Support:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
- The root opener skips directly to the appropriate route when `prefers-reduced-motion` is detected
- All transitions and animations must respect this media query

### Transitions & Duration

Keep animations brief and purposeful:
- **View/screen entry**: 0.32s ease-out (fade + subtle translate)
- **UI state changes** (expand, collapse, toggle): 0.16–0.2s
- **Progress/loading bars**: 0.3s
- **Micro-interactions** (hover, focus): 0.16s or instant
- **Logo opener animation**: Light and brief, fade transition

### Layering & Z-Index

**Z-Index Hierarchy:**
- `z-index: 1`: In-view sticky elements, form footers
- `z-index: 100`: Section headers (`.quest-header`, `.me-header`), the sticky bottom nav (`.home-bottom-nav`), and other persistent chrome
- `z-index: 110`: Toast notifications (`.quest-toast`, `.me-toast`, toast rules in `globals.css`) and popovers
- `z-index: 120`: Full-viewport overlays, such as the auth outcome modal (`.auth-outcome-overlay`). Use sparingly.

The `globals.css` header comment still reads "100=overlays, 110=modals"; the values above are authoritative.

Do not raise page controls above a modal layer to solve clipping issues; fix the modal z-index instead.

### Modals & Overlays

**Modal Backdrop:**
- Background: Semi-transparent dark navy `rgba(21, 29, 46, 0.48)` with `backdrop-filter: blur(1px)` (`.auth-outcome-overlay`)
- Position: Fixed, full viewport coverage, `z-index: 120`
- Dismissible: Keyboard (Escape) and touch (backdrop click)

**Modal Dialog:**
- Background: `var(--surface)` (#fff)
- Border radius: `clamp(14px, 2.5vw, 20px)`
- Padding: `clamp(20px, 4vw, 24px)`
- Max width: `min(100%, 340–440px)`
- Box shadow: Elevation shadow (e.g., `0 10px 40px rgba(0, 0, 0, 0.15)`)
- Position: Centered, above backdrop
- Keyboard support: Tab focus, Enter to confirm, Escape to close

**Overlay Content:**
- Modals remain within safe screen bounds
- Do not place interactive content outside the modal (behind the backdrop)
- Support both dismiss and action buttons

## 7. Design System Maintenance

### Stylesheet Structure

**October 14, 2026:** Coach Exercise Library now follows the supplied compact list and white video-detail sheet. The library keeps bottom navigation; its native modal dialog covers navigation while open, contains keyboard focus, closes with Escape/backdrop/close, and restores focus to its opener. The original safe-area aliases now remain authoritative instead of being overridden by duplicate declarations.

**October 14, 2026 — Scan:** Nutrition, Review Estimate, Today’s Log, Add Food, and Food History follow the supplied mobile references using shared palette/system typography and scoped styles. The existing API client and nutrition hook remain the live data path. A labeled, local reference preview is eligible only after a successful response with no meals and no recorded water; it persists across internal navigation and background refresh without replacing errors or real records. Sample manual/scan saves and water updates never call persistence APIs. Camera/upload always use backend analysis; the photo-source chooser offers a separate, explicit sample-estimate action.

All active web styles live in `frontend/app/globals.css`. This file is imported by the root layout.

**File Organization:**
1. CSS custom properties (`:root { ... }`)
2. Baseline resets (`*`, `html`, `body`)
3. Core layout classes (`.scene`, `.app-shell`, `.launch`, `.auth-screen`, etc.)
4. Section-specific styles (`.dashboard-container`, `.coach-section`, `.scan-content`, etc.)
5. Component styles (`.primary`, `.secondary`, `.input-wrap`, `.mission-card`, etc.)
6. Responsive overrides (media queries, typically at end)
7. Deprecated/legacy styles (marked clearly)

**Legacy Note:** `frontend/app/responsive-globals.css` is deprecated and should not be used. It contains older base rules; new styles go in `globals.css`.

### Adding New Styles

**Rules for Extension:**
- Search all occurrences of a selector before modifying; a later rule may control the rendered result
- Prefer targeted, component-scoped rules placed near their relevant sections
- Clearly label responsive overrides (e.g., `/* ─── Tablet (≥700px) ─── */`)
- Do not rewrite the full stylesheet or add competing stylesheets
- Keep the existing light palette, shared content frame, safe-area aliases, and section scroll behavior consistent

**When to Use `clamp()`:**
Use `clamp()` for responsive sizing instead of breakpoint-based rules:
- Text: `clamp(14px, 2.5vw, 18px)` (min, preferred, max)
- Spacing: `clamp(12px, 2.5vh, 20px)` (vertical spacing tied to viewport height)
- Component size: `clamp(36px, 7.5vw, 48px)` (icon size, touch target)

This eliminates breakpoint sprawl and provides smooth scaling across all viewport sizes.

### Color & Token Consistency

- Define new semantic colors as CSS custom properties in `:root`
- Avoid inline hex/rgb values in component styles
- Document the purpose and use cases for new tokens
- Group related tokens (e.g., all green variants, all gray/neutral variants)
- Update the design-system version and maintenance note when a significant interface pattern changes.

## 8. UI Review Checklist

Before committing any UI changes, verify:

### Layout & Spacing
- [ ] Content uses the shared centered frame (Home reference)
- [ ] Safe-area insets applied correctly (status bar, notches, home indicator, system nav)
- [ ] Each safe-area inset applied only once (not duplicated on parent + child)
- [ ] Responsive padding/margins use `clamp()` or follow existing breakpoint patterns
- [ ] Content gutters scale appropriately: 12–16px narrow phones, 16–32px mobile, 24–48px tablet+

### Responsive & Mobile
- [ ] Layout works at narrow phone (320–380px), standard phone (380–420px), large phone (520–740px landscape), tablet (700px+), and desktop (1024px+)
- [ ] Text wraps gracefully without colliding with controls
- [ ] Touch targets are at least 44px × 44px
- [ ] Flexible grids use `minmax(0, 1fr)` to prevent overflow
- [ ] No horizontal scrolling or overflow unless intentional (e.g., horizontal card carousel)
- [ ] Short-height screens (≤740px) handled properly (reduced padding, hidden decorative elements)

### Typography & Color
- [ ] All text uses the system font stack (no web fonts)
- [ ] Headings, body, and secondary text use correct size/weight from type scale
- [ ] Colors use CSS custom properties (`--ink`, `--green`, `--muted`, etc.)
- [ ] Color contrast meets WCAG AA standards for all text
- [ ] Status information not communicated by color alone (pair with icons/text)
- [ ] Demo/sample data clearly labeled as such

### Components & Interaction
- [ ] Primary CTAs use `.primary` (green surface, dark text)
- [ ] Secondary actions use `.secondary` (white, bordered)
- [ ] Button min-heights meet touch target requirement (44px+)
- [ ] Focus states visible on all interactive elements
- [ ] Icon-only buttons have `aria-label` or visible label
- [ ] Form labels associated with inputs (not just visual alignment)
- [ ] Disabled states distinguishable (opacity, color, pointer-events: none)

### Navigation
- [ ] Main section root retains tab bar
- [ ] Nested/detail flows hide tab bar
- [ ] Clear back button or completion action provided to parent
- [ ] Back button visually aligned with page heading
- [ ] Navigation preserves scroll position when possible

### Motion & Accessibility
- [ ] Animations respect `prefers-reduced-motion`
- [ ] No auto-play videos or animations that distract
- [ ] All transitions use appropriate duration (0.16–0.32s typically)
- [ ] Modal/overlay properly layered (z-index 100 range) and dismissible

### Safe Area & System Integration
- [ ] Text and buttons clear of status bar (top)
- [ ] Content not covered by notches or cutouts
- [ ] Home indicator / system nav area respected (bottom)
- [ ] Backgrounds may extend behind system bars; content does not
- [ ] On Expo WebView, safe-area insets handled (test on actual device if possible)

## 9. Section-Specific Patterns

### Home Dashboard
- **Header**: Avatar, greeting, notification bell with unread indicator
- **Workout Card**: Hero section (green background) with today's session, start button
- **Stats Row**: Icon + number + label (calories, level, etc.), separated by dividers
- **Content Sections**: Mission cards, nutrition overview (circular progress + macro list), journey cards
- **Responsive**: Nutrition card stacks vertically on narrow screens (< 380px)

### Notifications
- **Header**: Home back arrow, Notifications title, and a “Mark all read” action when unread items exist.
- **Pinned safety notice**: Use the pale-red alert surface for an actual API safety notification, or for the clearly labeled sample preview when that fallback has explicitly been requested. Keep live title and body API-sourced and make its CTA mark the live item read. Sample-only review actions must not imply access to a real session.
- **Notification groups**: Show Today first and Earlier last when those groups are present; preserve other API-provided group names. Render each API item as a compact, hairline-separated row with its icon, title, body, time, and a clear unread marker.
- **Data states**: Retain the API-backed loading and error/retry states. When no live records are returned successfully, show the requested screenshot-matched sample preview with an explicit sample label; its read actions are local and never sent to the backend. For live records, individual mark-read and mark-all-read remain API-backed. Keep the Home bottom navigation and safe-area spacing intact.

### Coach (Training)
- **Exercise Library sample preview**: Default to All muscles and Dumbbells, displaying the six supplied exercises in reference order. Use two horizontally scrollable filter rows with pill surfaces inside 44px touch targets, a search icon/input, result count, muted sample label, compact thumbnail rows, and AI tracked/Caution badges. Search and filters are local and combine; Any equipment removes the equipment restriction.
- **Exercise details**: White bottom sheet on phones, centered dialog at 700px and wider. Title and metadata precede the video preview, recommendation and form-tracking label, numbered instructions, and green check-circle form cues. The bench-press poster displays the media area of the unchanged supplied reference; other exercises state that video is coming soon. Play controls explicitly report that playback is not connected. No autoplay, fabricated AI analysis, or plan-saving action. Keep the sample/AI-unavailable note visible in the sheet.
- **Header**: Section title + back button (if nested)
- **Week View**: Grid of 7 day buttons with indicator dots, selected day highlighted green
- **Exercise List**: Numbered items with title, time, tracking tag (manual/automatic/caution)
- **Camera Preview**: Live video with pose frame, person overlay, distance indicator
- **Session View**: Dark background (#111827), form score badge, rep counter, exercise label
- **Live Controls**: Pause/End buttons, session progress bar

### Scan (Nutrition)
- **Reference presentation**: Compact sticky headers, a full green calorie-summary ring, macro tracks, rounded green scan CTA, thin meal dividers, and More links. Use the camera icon for scanning, shared glass icons for water, and shared bar-chart icons for history. Keep touch areas at least 44px; water displays eight glasses across standard phones and wraps to four columns on the narrowest phones.
- **Review Estimate**: Detected photo/items precede confidence badges and low-confidence guidance, Meal and Portion size pills, and the bordered macro table. Excluding an item or changing portions updates totals and the existing scan-save payload. Retain loading/time-limit progress, explicit errors/retry, unmatched-item exclusions, and degraded-result notices. Edit manually opens Add Food; the sticky footer keeps the save action disabled until matched items exist and while saving.
- **Add Food**: Meal pills, search, recent suggestions, radio-style results, quantity/unit controls, calculated nutrition, and a sticky Save to [meal] footer. Live search/detail/save remain API-backed. Convert the quantity when switching grams/servings so the actual portion stays the same. Disable save for invalid/incomplete/pending data and show failures without implying persistence.
- **Food History**: 7/30/90-day period pills, average daily intake over days with records, target comparison, calorie bars with target line, energy-based macro percentages, and expandable daily records. Derive live summaries from returned meals; the labeled preview uses the shared local fixtures. Retain bottom navigation on history and Today’s Log; Review Estimate and Add Food hide it.
- **Nutrition Card**: Circular calorie display + macro list with progress bars, backed by the nutrition API
- **Scan CTA**: Green button with camera icon, text overlay
- **Photo scan flow**: Camera/upload selection opens Review Estimate immediately; show progress, actionable errors, detected items, and unmatched items. Require user confirmation before saving matched items.
- **Logs & Target**: Daily calorie ring with remaining calories, macro progress, compact meal rows, water controls, and History action. Targets are shared with the nutrition overview. Keep the five-tab navigation visible on this screen.
- **Add Food Flow**: Search, food result details, portion entry, and save confirmation; recent selections are suggestions, not meal history.

### Quests
- **Level Card**: Large hero (green background), level number, streak counter, exp bar
- **Streak Calendar**: 7×1 or 7×4 grid of daily squares (active/freeze/today states)
- **Mission Items**: 2-column grid layout on desktop/tablet, stacked on mobile
  - **Incomplete missions**: Icon with NO background (transparent), title, progress bar, points in orange text
  - **Completed missions**: Icon with green background (#7ee582) + white checkmark overlay, full card styling, progress bar filled green
  - Card styling: White background, subtle border, thin shadow
  - Hover state: Slight lift (translateY), enhanced shadow
  - Progress bars: Light container (#eef0ee), green fill (#80e687), smooth animation on update
- **Badges Section**: 4-column grid, locked/earned states with lock indicator
- **Penalty Warning**: Orange/yellow background, warning icon, explanation text

### Me (Profile & Settings)
- **Profile Summary**: Avatar, name, email, edit button
- **Settings Rows**: Icon + title + description, toggle or arrow
- **Setting Block**: Group title + description, threshold buttons or toggles
- **Admin Tools**: Exercise Library and Analytics links open explicit local mock detail views for every signed-in account. The separate live backend endpoints retain administrator authorization.
- **Logout Button**: Prominent danger color, bottom of scroll area

## 10. Form Design & Input Controls

### Measurement Unit Controls (Height, Weight, Measurements)

Step 1 of calibration provides unit selectors for height (cm or ft/in), weight (kg or lbs), and measurements (cm or inches).

**Unit Toggle Button** (`.unit-switch`):
- Two-option toggle (e.g., "cm" / "in")
- Border: 1px `var(--line)`
- Border radius: `9px`
- Padding: `2px`
- Inactive option: transparent background, muted text
- Active option: white background, green text (#167336), box-shadow, font-weight 700
- Smooth transition on state change

**Height Input (Dual Fields for Imperial):**
- When metric: Single input for cm
- When imperial: Separate number fields for feet and inches
- On unit change: Convert value, keep it paired with new unit (don’t silently reinterpret)
- BMI: Normalize to metric internally; display uses selected unit

**Input Alignment:**
- Visually aligned with existing bordered input fields
- Keyboard focus state visible and usable
- Touch target at least 44px height

### Calibration & Multi-Step Forms

**Progress Bar:**
- Visual: 4 thin bars (one per step), light container, green fill for completed
- Placement: Below or within step header

**Step Header:**
- Small eyebrow: "Step 1 of 4 · Calibration" (11–12px, green-dark, uppercase optional)
- Step heading (h2): Primary title (e.g., "Personal Data")
- Description: Subtitle (13–16px, muted, italic optional)

**Step Footer:**
- Primary button: "Next: [Step Name] →" or "Finish & build my plan →"
- Back button: Text-only, muted, optional on first step
- Clear spacing before button (18–27px margin)
- Sticky positioning: Button stays in view at bottom, scroll content has trailing space

**Form Validation:**
- Inline feedback: Error text below field (12px, red #bd3030)
- Required indicator: "Required" badge in red on labels
- Success state: Green check or highlight (not just green border)
- Disabled state: Reduced opacity (0.5), `pointer-events: none`
