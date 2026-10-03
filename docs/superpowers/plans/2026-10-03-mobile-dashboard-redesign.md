# Mobile Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the supplied compact mint-and-white mobile references across Home, its detail screens, Notifications, and Me without changing product behavior or backend connections.

**Architecture:** Keep the existing component tree, props, callbacks, and client state. Add only visual layout hooks where the reference needs a missing grouping, then add a component-scoped override layer at the end of the existing global stylesheet.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS custom properties, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-03-mobile-dashboard-redesign-design.md`

## Global Constraints

- Preserve all existing component props, callbacks, local state, routes, API calls, local storage, authentication, schemas, request timing, and business rules.
- Do not modify backend files or API clients.
- Do not introduce dependencies or web fonts; reuse the project system font stack and existing `Icon` registry.
- Use existing palette tokens, keep 44px touch targets, visible focus states, reduced-motion support, safe-area clearance, and no horizontal scrolling from 320px upward.

## Review Focus

- Notification Mark all read must clear every unread indicator; test the existing `setItems` update.
- Progress metric pills must retain the current series selection behavior; test the `setMetric` path.
- Me switches and threshold selections must retain persisted local-storage behavior; test the existing keys and effects.
- Root Home and Me views must retain `BottomNav`; tests must ensure no backend or API imports are added to redesigned screens.
- At phone width, content must clear the fixed bottom navigation without horizontal overflow; confirm manually.

---

### Task 1: Add visual-redesign behavior guards

**Files:**
- Create: `frontend/tests/mobile-redesign.test.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: Current screen source modules and Node 22 `node:test`.
- Produces: `npm run test:ui-guard`, a no-dependency behavior boundary test.

- [ ] **Step 1: Write the guard tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('progress keeps local metric selection', async () => {
  const file = await source('sections/Home/Progress.tsx');
  assert.match(file, /useState\('Weight'\)/);
  assert.match(file, /onClick=\{\(\) => setMetric\(option\)\}/);
  assert.match(file, /const data = series\[metric\]/);
});
test('notifications keep readable state updates', async () => {
  const file = await source('sections/Home/Notifications.tsx');
  assert.match(file, /setItems\(current => current\.map/);
  assert.match(file, /onRead=\{\(\) => setItems/);
});
test('Me keeps persistence and root navigation', async () => {
  const file = await source('sections/Me Section/MeSection.tsx');
  assert.match(file, /localStorage\.getItem\('physiquequest-me-settings'\)/);
  assert.match(file, /localStorage\.setItem\('physiquequest-me-settings'/);
  assert.match(file, /<BottomNav \/>/);
});
```

- [ ] **Step 2: Run the test before visual changes**

Run `node --test tests/mobile-redesign.test.mjs` from `frontend`. Expected: PASS; this records current behavior that visual work must preserve.

- [ ] **Step 3: Add the package script**

Add `"test:ui-guard": "node --test tests/mobile-redesign.test.mjs"` to the existing `scripts` object in `frontend/package.json`.

- [ ] **Step 4: Verify and commit**

Run `npm run test:ui-guard` from `frontend`; expected: three passing named tests. Commit only `frontend/tests/mobile-redesign.test.mjs` and `frontend/package.json` with message `test: guard dashboard visual redesign behavior`.

### Task 2: Align Home, goals, progress, and notification content structure

**Files:**
- Modify: `frontend/sections/Home/HomeDashboard.tsx`
- Modify: `frontend/sections/Home/GoalsMilestones.tsx`
- Modify: `frontend/sections/Home/Progress.tsx`
- Modify: `frontend/sections/Home/Notifications.tsx`

**Interfaces:**
- Consumes: Existing `Profile`, `Icon`, callbacks (`onOpen`, `onNotify`, `onAction`, `onBack`), and local `useState`.
- Produces: Reference-aligned semantic class hooks; each current callback and state setter remains at its current invocation site.

- [ ] **Step 1: Verify the pre-change guard**

Run `npm run test:ui-guard` from `frontend`; expected: PASS.

- [ ] **Step 2: Add only meaningful presentation hooks**

Use wrapper boundaries such as the following where the current DOM lacks a needed reference layout group:

```tsx
<section className="progress-overview">
  <div className="metric-tabs">{/* existing metric buttons */}</div>
  <div className="metric-value">{/* existing value and delta */}</div>
  <div className="chart" role="img">{/* existing bar series */}</div>
</section>
```

Keep item keys, literal labels, handlers, state setters, and action targets unchanged. Build the Home session card, divided stat strip, mission rows, nutrition module, goals timeline, progress chart/records/accuracy, and notification safety alert from their existing content rather than adding new data.

- [ ] **Step 3: Verify and commit**

Run `npm run test:ui-guard && npm run build` from `frontend`; expected: both commands pass. Commit the four Home source files with message `feat: align Home detail screen structure`.

### Task 3: Apply the reference visual system to Home and Me

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/sections/Me Section/MeSection.tsx`

**Interfaces:**
- Consumes: Existing CSS tokens, Home selector hooks, Me source groups, and `BottomNav`.
- Produces: Scoped styles for cards, progress, charts, list rows, alert, setting groups, switches, logout, and selected navigation states.

- [ ] **Step 1: Verify the guard before CSS edits**

Run `npm run test:ui-guard` from `frontend`; expected: PASS.

- [ ] **Step 2: Append a component-scoped reference override section**

Append a final `/* ─── Mobile reference redesign ─── */` section to `globals.css`. It must use a near-flat white root surface; compact 12–20px gutters; hairline `var(--line)` separators; pale-green feature cards; 5–7px mint progress tracks; quiet dense metadata; rounded selected bottom-nav icon tiles; pale-red pinned alert; and a bordered red logout action. Begin from this safe scope:

```css
.home-section, .me-section { background: var(--surface); }
.home-bottom-nav { border-top: 1px solid var(--line); background: var(--surface); }
.home-bottom-nav button.active .nav-icon { background: var(--green); border-radius: 10px; }
.workout-card, .goal-hero, .accuracy-card { background: #effaf0; box-shadow: none; }
```

Extend the same scope to dashboard content, goals, progress, notifications, and `.me-*` selectors. Do not rewrite existing stylesheet sections or modify unrelated Coach, Scan, or Quests selectors.

- [ ] **Step 3: Preserve Me behavior while exposing any missing CSS hooks**

If required, add a wrapper like `<section className="me-settings-groups">` around the existing setting groups. Do not alter `Settings`, `AdminView`, local-storage key, `toggle`, `onLogoutRequest`, or admin view transitions.

- [ ] **Step 4: Verify and commit**

Run `npm run test:ui-guard && npm run build` from `frontend`; expected: both commands pass. Commit `frontend/app/globals.css` and `frontend/sections/Me Section/MeSection.tsx` with message `feat: restyle mobile dashboard and settings`.

### Task 4: Final visual and integration verification

**Files:**
- Verify: `frontend/app/globals.css`, Home detail source files, and `frontend/sections/Me Section/MeSection.tsx`

**Interfaces:**
- Consumes: Complete frontend redesign and behavior guard.
- Produces: Evidence that the redesign is visual-only and responsive.

- [ ] **Step 1: Run automated verification**

Run `npm run test:ui-guard && npm run build` from `frontend`. Expected: all checks pass.

- [ ] **Step 2: Verify change boundaries**

Run `git diff --check` and `git diff -- frontend/lib backend` from repository root. Expected: no whitespace errors and no backend/API-client modifications.

- [ ] **Step 3: Compare at phone and wide layouts**

Inspect Home, Goals, Progress, Notifications, Me root, and Me settings at 320px, 390px, 700px, and 1024px. Confirm white backgrounds, compact headers, navy type, pale-green emphasis, mint progress/selection, thin dividers, quiet cards, and bottom-nav clearance with no horizontal overflow.

- [ ] **Step 4: Commit verification record**

Commit the plan’s completed checklist only after all verification is complete, with message `docs: record mobile redesign verification`.
