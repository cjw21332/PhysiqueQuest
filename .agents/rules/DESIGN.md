---
description: Current visual and responsive design system for the PhysiqueQuest web app and Expo WebView. Follow these rules for every UI change.
---

# PhysiqueQuest Design System

This document describes the current PhysiqueQuest product, light-theme interface, and rules for extending it. The web app is the source of UI; the Expo app displays it in a native WebView.

## 1. Current Interface

- PhysiqueQuest is a mobile-first fitness and nutrition prototype. The Next.js web app provides product UI and behavior; the Expo app hosts it in a native WebView and provides device capabilities such as safe-area insets and camera/file inputs.
- Signed-in users have five main sections: Home, Coach, Scan, Quests, and Me. The root route shows the logo-led opener, then continues to Home for a locally authenticated user or Launch otherwise. Launch and Login are prototype entry flows. Register validates the account form, then opens a four-step calibration flow (Personal Data, Goals, Training Preference, Health & Safety); it saves the profile and starts the local session only after the final step.
- Home contains the training dashboard, goals and milestones, progress, and notifications. Coach contains a weekly training plan, exercise library, camera check, live workout, and post-workout report. Scan contains nutrition overview, meal review, Add Food, Today’s Log with water tracking, and Food History. Quests contains level/streak progress, daily missions, rewards, and leaderboard entry. Me contains profile, safety, privacy, account settings, and Admin tools.
- Me’s Admin tools open two focused views: Exercise Library (search, publication/pose filters, and draft creation) and Engagement Analytics (date ranges, retention visualization, emergency-event summary/export). These are frontend demonstrations backed by local in-memory sample data, not a connected admin API.
- Authentication, onboarding, food logging, quest progress, and settings are prototype behavior. Some values use browser localStorage; other screens use static fixtures or in-memory demo state. There is no live backend, remote account service, cross-device sync, or database connection. Calorie estimates, AI/form scores, camera readiness, workout feedback, analytics, and emergency-event counts must be presented as sample/demo behavior until real services exist.
- MongoDB Atlas is the planned future database, not an implemented system dependency. Follow `DATABASE.md` for persistence, API, domain ownership, and service rules.
- The overall product theme is light. The live workout view intentionally uses a dark focus surface; do not extend that treatment to other sections without a product decision.
- The opener uses the PhysiqueQuest logo and the tagline “Fitness That Fits Your Life”.
- The main navigation has five tabs and sits above the device system-navigation area on main section screens. Focused nested/detail flows hide the tab bar to free the content layout; those views provide a clear back or completion action to their parent/root. This includes Home subviews, Coach Exercise Library/camera/live session/report, Scan review/add/log/history, and Me Admin tools. The main dashboard/plan/nutrition, Quests, and Me settings screens retain the tab bar.
- Home is the reference for the signed-in content width and page gutters. Reuse the shared centered content frame rather than inventing different outer page widths.

## 2. Color and Type

Core colors are CSS custom properties in frontend/app/globals.css. Reuse them for new UI.

| Token | Value | Use |
|:--|:--|:--|
| --bg | #f4f6f3 | App/page background |
| --surface | #fff | Main content, cards, and controls |
| --soft | #f4f7f4 | Quiet surfaces and inactive controls |
| --line | #e8ede9 | Borders and dividers |
| --ink | #192233 | Primary text and icons |
| --muted | #627087 | Secondary text and hints |
| --green | #7ee582 | Primary action and progress |
| --green-dark | #167336 | Green-surface text and secondary brand accents |

Use the native system font stack: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif. Do not add web fonts.

Scale headings, body text, spacing, and control sizes with clamp() where the layout needs to adapt. Keep headings compact, body text readable, and secondary text legible on small phones. Typical targets are 18–24px for page headings, 13–16px for body copy, and 11–13px for supporting text; do not shrink controls or labels to fit.

Use semantic status colors already present in the stylesheet for error, warning, success, and information states. Avoid adding new palette variables or decorative color systems without approval.

## 3. Shared Layout and Safe Areas

- The app fills the available viewport and keeps the same centered outer frame across Home, Coach, Scan, Quests, and Me. The shared maximum content width is 1000px and the standard gutter is --content-gutter.
- Keep content fluid on narrow phones, tablets, and desktop. Avoid fixed page widths and horizontal overflow; let dense controls wrap or scroll within their own row.
- The shared app-shell reserves the top, bottom, left, and right device insets. On the Expo WebView, mobile/App.tsx publishes native values as --safe-top, --safe-bottom, --safe-left, and --safe-right. CSS aliases --sat, --sab, --sal, and --sar fall back to env(safe-area-inset-*).
- Apply each safe-area inset once. Do not add the same top or bottom inset to a child when its parent already reserves it.
- Backgrounds may extend behind transparent system bars, but text, buttons, navigation, and other interactive content must remain clear of the status bar, cutouts, home indicator, and Android system navigation buttons.
- Keep one primary scroll region per screen when possible. The main navigation is a separate layout item; it must not cover scroll content.
- Use sticky action bars only when they help a form or task. Keep them inside the section scroll frame, leave enough trailing content space for the final control to scroll clear, and do not use sticky positioning for ordinary in-flow actions such as Coach’s Start session button.

## 4. Responsive Rules

- Design mobile first from narrow portrait phones. Also check short-height screens, landscape phones, tablets, laptops, and wide desktop.
- Existing breakpoints include small-screen rules around 380–420px, tablet rules around 700–768px, desktop rules at 1024px and 1200px, and short-screen rules around 520px and 740px. Follow nearby patterns rather than adding competing breakpoints.
- Use grid columns that can shrink with minmax(0, 1fr), min-width: 0 on flexible children, and wrapping for chips and buttons.
- Charts should scale to available width. Lists should preserve readable labels and touch targets instead of forcing page-wide horizontal scrolling.
- The app’s maximum content frame stays centered on large screens; do not stretch text or controls across the full desktop width.

## 5. Components and Interaction

- Keep the current PhysiqueQuest visual language: clear page titles, restrained card surfaces, fine borders, modest radii, and limited shadows.
- Primary actions use the existing .primary style (green surface, dark text). Secondary actions use .secondary (light surface and border).
- Provide at least a 44px interactive hit area for touch controls. Shared back buttons use a responsive 44–52px target and must remain visually aligned with their heading.
- Provide visible focus states, accessible names for icon-only controls, and disabled states that remain distinguishable.
- Use the shared Icon component in frontend/sections/Home/icons.tsx for interface icons. Add to its registry before using a new icon. Do not add an icon package.
- Secondary views need a clear way back to their parent view. Preserve the actual parent view when entering nested Scan flows such as Add Food and Food History. Hide the main tab navigation on focused nested views so they can use the available screen layout; keep navigation visible on main section roots.
- Use concise labels and status copy. Do not present sample or demo values as verified user data.

## 6. Motion, Overlays, and Layers

- Respect prefers-reduced-motion. The root opener skips directly to the appropriate route when reduced motion is requested.
- Keep the logo opener brief and light themed. Reuse its existing logo asset, motion timing, fade transition, and “Fitness That Fits Your Life” tagline if adjusting it.
- Use the existing screen-enter motion for top-level screen entry. Keep state changes and navigation understandable without animation.
- Modals and overlays must remain within safe screen bounds, support keyboard/touch dismissal where appropriate, and use the established layer order.
- Follow the current z-index roles: in-view sticky elements stay low; the main navigation and modal layer use the established 100 range; global status toasts use the higher 110 range. Do not raise a page control above a modal to solve clipping.

## 7. Stylesheet and Maintenance

- All active web styles belong in frontend/app/globals.css. Root layout imports this file. frontend/app/frontend/app/responsive-globals.css is legacy and is not the active global stylesheet.
- The stylesheet contains older base rules and later responsive overrides. Search all occurrences of a selector before changing it; a later rule may control the rendered result.
- Prefer a targeted, section-scoped rule near the relevant section or a clearly labelled responsive override at the end. Do not rewrite the full stylesheet or add a competing stylesheet.
- Keep the existing light palette, shared content frame, safe-area aliases, and section scroll behavior consistent.

## 8. UI Review Checklist

- [ ] Does the page align with Home’s shared content frame and gutters?
- [ ] Are status-bar, cutout, and system-navigation areas clear of interactive content?
- [ ] Is each safe-area inset applied only once?
- [ ] Does the layout work at narrow phone, tablet, and desktop widths and at short heights?
- [ ] Can flexible text shrink or wrap without colliding with controls?
- [ ] Do fixed or sticky actions leave enough room to reach the final content?
- [ ] Are touch targets at least 44px and focus states visible?
- [ ] Are sample/demo data and camera capabilities clearly described?
- [ ] Does the page respect reduced motion and use the shared icon system?
