# PhysiqueQuest

A responsive, mobile-first fitness application with a Next.js frontend, Expo Go WebView shell, NestJS API, and MongoDB Atlas persistence for authentication and user profiles.

## System status

**Release:** [PhysiqueQuest v3.1.1](./docs/releases/RELEASE-v3.1.1.md) — connected workout improvements, calibration drafts, accessibility and local camera-readiness integration. Actual-device camera calibration remains pending.

**[Open the full system functionality checklist](./docs/checklist.md)** for all 17 modules, specific completed and outstanding functions, verification dates, and progress totals.

- The checklist reports frontend implementation, backend implementation/test coverage, and genuine end-to-end user-data verification separately.
- Only the end-to-end section indicates a demonstrated frontend-to-backend flow; its checked items refer to historical evidence, not a fresh production run.

## Run locally

Install root dependencies with `npm install`. Start the backend from `backend/` with `npm install` and `npm run start:dev`; start the frontend with `npm run dev` from the root. Start Expo Go with `npm run expo` from a third terminal. Configure MongoDB and JWT environment variables in `backend/.env`; keep secrets out of client environment files.

Phiq is the assistant available across Home, Coach, Scan, Quests and Me. Model requests use OpenAI GPT-6 Luna through the backend. Set `OPENAI_API_KEY` in `backend/.env`; never place the key in frontend or mobile configuration. Personal records require explicit chat consent and relevant context can be sent to OpenAI. Configure the OpenAI project's data-sharing settings separately.

Phiq covers reviewed routes and pages, uses current-page context, and answers common page help and exact supported metrics directly. For a hosted installation, see [the production container and HTTPS gateway guide](ai/deploy/README.md).

The food scanner uses OpenAI for image recognition and USDA for nutrition lookups. An AI workout insight is available on completed reports; video analysis also requires the pose service.

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

## Project layout

| Folder | What lives there |
|---|---|
| `frontend/` | Next.js web app (the UI the mobile app also loads) |
| `backend/` | NestJS API, MongoDB models, maintenance scripts in `backend/scripts/` |
| `mobile/` | Expo / React Native app and Android project |
| `shared/` | Rep counting and pose logic shared by web and mobile |
| `pose-service/`, `ml/`, `ai/` | Pose service, ML training/evaluation (`ml/scripts/debug/` holds one-off data checks), local AI coach setup |
| `scripts/` | Repo-level helper scripts; Windows build/push launchers are in `scripts/windows/` |
| `tools/` | Developer tooling: `eval/`, `gif-config/`, and AI-agent skill setup in `agent-setup/` |
| `patches/` | Patch series applied to dependencies |
| `docs/` | All documentation — see [docs/README.md](./docs/README.md) |
| `Progress/`, `ProgressReports/` | Per-service progress logs and numbered progress reports |
| `artifacts/`, `output/` | Built APKs, test runs and generated reports (older APKs in `artifacts/android/archive/`) |

Root files kept on purpose: `README.md`, `RUNNING.md` (how to run), `DESIGN.md` / `PRODUCT.md` (design and product rules), agent instructions (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `RTK.md`), `THIRD_PARTY_NOTICES.md`, and workspace config (`package.json`, `tsconfig.json`, `metro.config.js`, `seed.ts`, `opencode.json`, `skills-lock.json`).

## Documentation

- [System functionality checklist](./docs/checklist.md) — module inventory, function-level status, verification evidence, and progress bars.
- [docs/superpowers/](./docs/superpowers/) — cross-project design specs and implementation plans.
- [docs/mobile/](./docs/mobile/) — Expo Go reliability design and mobile plans.
- [ProgressReports/](./ProgressReports/) — numbered progress reports.
- `backend/scripts/` — one-off maintenance scripts (for example `delete-user.ts`).
