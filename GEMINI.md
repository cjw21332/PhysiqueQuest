# PhysiqueQuest — Mandatory Project Rules

> These rules are **always active** and **non-negotiable**. Every agent interacting with this codebase must follow them without exception.

---

## 1. Architecture & Monorepo Structure

- This is an **npm workspaces monorepo** with two workspace packages: `frontend/` and `mobile/`. `backend/` is a separately managed NestJS service (own `package.json`, installed and run from `backend/`), and `food-scanner/` is an internal-only external service with its own repo.
- **NEVER** create files outside these packages (except root config files like `package.json`, `.gitignore`, `GEMINI.md`, `PROGRESS-*.md`, `README.md`).
- **NEVER** install dependencies at the root. Use `--workspace frontend` or `--workspace mobile`.
- The `frontend/app/frontend/` directory exists for legacy routing reasons. Do NOT create new routes there.

## 2. Technology Stack (Locked)

| Layer        | Technology                           | Version Pinning             |
|:-------------|:-------------------------------------|:----------------------------|
| Framework    | Next.js (App Router)                 | `^16.x`                    |
| Language     | TypeScript (strict mode)             | `^5.x`                     |
| Styling      | Tailwind CSS v4 + vanilla CSS        | `^4.x` via `@tailwindcss/postcss` |
| UI Runtime   | React                                | `19.x`                     |
| Mobile       | Expo + React Native WebView          | Expo `^57.x`               |
| Build        | PostCSS with `@tailwindcss/postcss`  | —                          |

- **DO NOT** add new frameworks, CSS libraries, or UI component kits (no Chakra, MUI, shadcn, etc.) without explicit user approval.
- **DO NOT** switch from App Router to Pages Router.
- **DO NOT** add `next/font` or `@next/font` — the project uses system fonts.

## 3. Directory & File Organization

### Frontend Structure (strict)

```
frontend/
├── app/                      # Next.js App Router
│   ├── (app)/                # Authenticated routes (home, coach, scan, quests, me)
│   │   ├── layout.tsx        # Auth guard layout
│   │   ├── home/page.tsx
│   │   ├── coach/page.tsx
│   │   ├── scan/page.tsx
│   │   ├── quests/page.tsx
│   │   └── me/page.tsx
│   ├── (auth)/               # Unauthenticated routes (login, register)
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── launch/page.tsx       # Welcome/landing screen
│   ├── layout.tsx            # Root layout (metadata, viewport, CSS import)
│   ├── page.tsx              # Root redirect (auth check → /home or /launch)
│   └── globals.css           # ALL styles in ONE file
├── sections/                 # Feature section components (UI logic)
│   ├── Auth/                 # AuthForm.tsx
│   ├── Coach/                # CoachSection.tsx, CoachPlan.tsx, etc.
│   ├── Forgot Password/      # ForgotPasswordFlow.tsx
│   ├── Home/                 # HomeSection.tsx, BottomNav.tsx, icons.tsx, etc.
│   ├── Me Section/           # MeSection.tsx
│   ├── Quests Section/       # QuestSection.tsx
│   └── Scan/                 # ScanSection.tsx, NutritionDashboard.tsx, etc.
├── components/               # Shared/reusable components (LogoutModal, etc.)
├── lib/                      # Utilities (auth.ts, future helpers)
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── package.json
```

### Rules for files:
- **Route pages** (`app/**/page.tsx`) handle: auth checks, profile loading from localStorage, LogoutModal wiring, and rendering the corresponding section component. They should be thin wrappers.
- **Section components** (`sections/*/`) contain ALL feature UI logic and sub-views. They manage their own internal view state via `useState<View>`.
- **Shared components** (`components/`) are for truly reusable pieces used across multiple sections.
- **Utilities** (`lib/`) are for non-UI logic (auth, data helpers, future API clients).
- **Data/types** files (`types.ts`, `exercises.ts`, etc.) live alongside their section.
- **Icons** live in `sections/Home/icons.tsx` as the centralized icon registry.

### Naming Conventions:
- Section folders: **PascalCase** (e.g., `Auth/`, `Coach/`, `Me Section/`, `Quests Section/`).
- Component files: **PascalCase.tsx** (e.g., `HomeSection.tsx`, `BottomNav.tsx`).
- Utility/data files: **camelCase.ts** (e.g., `auth.ts`, `exercises.ts`, `types.ts`).
- Route pages: always `page.tsx` inside their route folder.
- CSS class names: **kebab-case** (e.g., `home-section`, `quest-badge-grid`).

## 4. CSS & Styling Rules

- **ALL styles** go in `frontend/app/globals.css`. Do NOT create separate CSS files or CSS modules.
- The file starts with `@import "tailwindcss";` — Tailwind v4 utility classes are available.
- Custom CSS uses **CSS custom properties** defined in `:root` (e.g., `--ink`, `--green`, `--muted`, `--line`, `--soft`, `--surface`, `--bg`).
- Safe-area insets are exposed as `--sat`, `--sab`, `--sal`, `--sar`.
- Use the existing color palette — do NOT introduce new CSS variables without explicit approval:
  - `--ink: #192233` (text)
  - `--muted: #627087` (secondary text)
  - `--green: #7ee582` (primary accent)
  - `--green-dark: #167336` (dark accent)
  - `--line: #e8ede9` (borders)
  - `--soft: #f4f7f4` (subtle backgrounds)
  - `--surface: #fff` (card surfaces)
  - `--bg: #f4f6f3` (page background)
- **Responsive breakpoints** in use: `700px` (tablet), `390px` (small phone), `740px` (short screens).
- **Reduced motion**: respect `prefers-reduced-motion: reduce`.
- All screen entry animations use the `screen-enter` class (0.32s ease-out fade+slide).
- Button styles use `.primary` (green) and `.secondary` (white with border).

## 5. Component Patterns (Enforced)

### Route Page Template
Every route page inside `(app)/` MUST follow this exact pattern:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import XxxSection from '../../../sections/Xxx/XxxSection';
import LogoutModal from '../../../components/LogoutModal';
import { getCurrentUser, logout } from '../../../lib/auth';

export default function XxxPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) { router.push('/'); return; }
    try {
      const saved = localStorage.getItem('physiquequest-profile');
      if (saved) setProfile(JSON.parse(saved));
    } catch { setProfile({}); }
  }, [router]);

  const handleLogout = () => { logout(); router.push('/'); };
  if (!profile) return null;

  return (
    <main className="scene">
      <div className="app-shell">
        <XxxSection profile={profile} onLogoutRequest={() => setShowLogoutModal(true)} />
        <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={handleLogout} />
      </div>
    </main>
  );
}
```

### Section Component Template
Every section component MUST:
1. Accept `{ profile: Profile; onLogoutRequest?: () => void }` props.
2. Use `useState<View>` to manage internal sub-views.
3. Include `<BottomNav />` at the bottom.
4. Use a toast pattern for ephemeral feedback messages.

### Icons
- All SVG icons MUST go through the `Icon` component in `sections/Home/icons.tsx`.
- Add new icons to the `paths` record in that file — do NOT create separate SVG files or import external icon packs.

## 6. State Management

- **localStorage only** for persistence. Use the established keys:
  - `physiquequest-auth` — authentication session
  - `physiquequest-profile` — user profile/onboarding data
  - `physiquequest-food-log` — nutrition log data
- **No external state management libraries** (no Redux, Zustand, Jotai, etc.). Use React `useState` and `useEffect`.
- Auth utilities live in `lib/auth.ts`. All auth logic goes through `login()`, `logout()`, `getCurrentUser()`, `isAuthenticated()`.

## 7. Routing Rules

- Use Next.js App Router route groups: `(app)` for authenticated, `(auth)` for unauthenticated.
- Navigation uses `useRouter().push()` — NEVER use `<Link>` for programmatic navigation.
- The `(app)/layout.tsx` auth guard redirects unauthenticated users to `/`.
- Bottom navigation lives in `BottomNav.tsx` and uses `usePathname()` for active state.
- **Five main tabs**: `/home`, `/coach`, `/scan`, `/quests`, `/me`.

## 8. Mobile Companion (Expo)

- The `mobile/` package is a WebView wrapper that loads the live Next.js web app.
- It injects safe-area insets as CSS custom properties (`--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right`).
- **DO NOT** add native screens or React Native UI components to the mobile package. All UI lives in the web app.
- Connection fallback screen shows when the web app is unreachable.

## 9. Debugging & Fixing Rules

- **ALWAYS read the file** before editing. Never edit blind.
- **ALWAYS preserve existing comments and code** unrelated to the fix.
- When fixing a bug: (1) identify the root cause, (2) explain the fix before applying, (3) verify no regressions.
- **NEVER** delete or rename existing PROGRESS-*.md files.
- When making significant changes, create or update the next `PROGRESS-N.md` file.
- **NEVER** clear `globals.css` or rewrite it from scratch — it is 3600+ lines and accumulated over 7 iterations.

## 10. Build & Dev Commands

| Command          | Action                          |
|:-----------------|:--------------------------------|
| `npm install`    | Install all workspace deps      |
| `npm run dev`    | Start Next.js dev server (0.0.0.0:3000) |
| `npm run expo`   | Start Expo Go LAN bridge        |
| `npm run build`  | Production build (frontend)     |
| `npm run start`  | Production server (frontend)    |

- Dev server uses `.next-dev/` as dist dir; build uses `.next/`.
- **NEVER** change the dev server port from 3000 (the mobile app depends on it).
- **NEVER** change the hostname binding from `0.0.0.0` (required for LAN access).

## 11. Accessibility & Quality

- All interactive elements MUST have accessible labels (`aria-label`, `role`, etc.).
- Toast/notification messages use `role="status"`.
- Modals use overlay click-to-dismiss and `stopPropagation` patterns.
- Navigation uses `<nav>` with `aria-label="Main navigation"`.
- Eye toggle buttons use `aria-pressed` for screen readers.

## 12. What NOT to Do (Forbidden Actions)

- ❌ Do NOT create new CSS files — use `globals.css`.
- ❌ Do NOT add new dependencies without user approval.
- ❌ Do NOT change the monorepo structure or workspace layout.
- ❌ Do NOT use Pages Router patterns (like `getServerSideProps`).
- ❌ Do NOT introduce server components for routes that need client interactivity — use `'use client'`.
- ❌ Do NOT use `any` for new code — add proper TypeScript types. (Existing `any` usage in route pages is tech debt to be cleaned up later.)
- ❌ Do NOT delete or overwrite `PROGRESS-*.md` files.
- ❌ Do NOT modify the root `package.json` workspace config.
- ❌ Do NOT create API routes until the `backend/` package is set up.
