# PhysiqueQuest

A responsive, mobile-first fitness application with a Next.js frontend, Expo Go WebView shell, NestJS API, and MongoDB Atlas persistence for authentication and user profiles.

## Run locally

Install root dependencies with `npm install`. Start the backend from `backend/` with `npm install` and `npm run start:dev`; start the frontend with `npm run dev` from the root. Start Expo Go with `npm run expo` from a third terminal. Configure MongoDB and JWT environment variables in `backend/.env`; keep secrets out of client environment files.

## Run on a phone with Expo Go

1. Install dependencies with `npm install` from the project root.
2. Start the NestJS API from `backend/` with `npm run start:dev` in one terminal.
3. Start the live web app with `npm run dev` from the root in a second terminal.
4. Start the Expo Go bridge with `npm run expo` in a third terminal.
5. Connect your phone and computer to the same Wi-Fi, install or update Expo Go, and scan the Expo terminal QR code.

The Expo app opens the live Next.js app in a native WebView. On a LAN session it infers the computer's private IPv4 address, loads the frontend on port 3000, and sends API requests to that host on port 4000. The wrapper reports frontend/backend connectivity separately and provides manual frontend address recovery. Expo's tunnel only carries the Expo bundle; it does not tunnel ports 3000 or 4000. See [RUNNING.md](./RUNNING.md#mobile-application-expo-go) for optional public URL settings and recovery steps.

## Folders

- `frontend/app/` — Next.js app entry point and responsive styling.
- `frontend/sections/Auth/` — registration and login screens.
- `frontend/sections/Home/` — dashboard, bottom navigation, goals, progress, notifications, and shared Home icons.
- `frontend/sections/Coach/` — coach plan, exercise library, camera check, live session, and workout report.
- `frontend/sections/Scan/` — nutrition overview, meal review, manual food entry, daily log, and history.
- `frontend/sections/Quests Section/` — server-derived daily missions, badges, and streak state.
- `frontend/sections/Me Section/` — profile summary, settings, safety alert delivery state, and role-protected admin tools.
- `mobile/` — Expo Go companion that opens the live Next.js app in a native WebView.
- `backend/` — NestJS authenticated APIs and MongoDB persistence for user features, admin data, and provider-backed services.

## Current prototype

Registration, login, profiles, nutrition, settings, notifications, workout sessions, progress measurements, and mission state use authenticated backend APIs. Workout form analysis, reset-email delivery, and emergency alert delivery require optional backend provider credentials; the app shows an unavailable state until those services are configured. Admin APIs require a database-provisioned admin role. See `backend/README.md` and `RUNNING.md` for setup and verification details.

## Progress report

All reports live in [ProgressReports/](./ProgressReports/). See [PROGRESS.md](./ProgressReports/PROGRESS.md) for the initial onboarding handoff, [PROGRESS-2.md](./ProgressReports/PROGRESS-2.md) for Home, [PROGRESS-3.md](./ProgressReports/PROGRESS-3.md) for Coach, [PROGRESS-4.md](./ProgressReports/PROGRESS-4.md) for Scan, [PROGRESS-5.md](./ProgressReports/PROGRESS-5.md) for Quests, and [PROGRESS-6.md](./ProgressReports/PROGRESS-6.md) for Me.

See [PROGRESS-10.md](./ProgressReports/PROGRESS-10.md) and [PROGRESS-11.md](./ProgressReports/PROGRESS-11.md) for backend integration, unit-aware profile persistence, and Expo Go improvements.

## Documentation

- [docs/superpowers/](./docs/superpowers/) — cross-project design specs and implementation plans.
- [docs/mobile/](./docs/mobile/) — Expo Go reliability design and mobile plans.
- [ProgressReports/](./ProgressReports/) — numbered progress reports.
- `backend/scripts/` — one-off maintenance scripts (for example `delete-user.ts`).
