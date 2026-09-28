# PhysiqueQuest

A responsive, mobile-first fitness onboarding prototype based on the supplied design references. The project is split into `frontend/` and `backend/` so each part has a clear place to grow.

## Run locally

Install dependencies with `npm install`, then start the app with `npm run dev`. Open the local address shown in the terminal. The same responsive app works in phone, tablet, and desktop browsers.

## Folders

- `frontend/app/` — Next.js app entry point and responsive styling.
- `frontend/sections/Auth/` — registration and login screens.
- `frontend/sections/Home/` — dashboard, bottom navigation, goals, progress, notifications, and shared Home icons.
- `frontend/sections/Coach/` — coach plan, exercise library, camera check, live session, and workout report.
- `frontend/sections/Scan/` — nutrition overview, meal review, manual food entry, daily log, and history.
- `backend/` — handoff notes and reserved location for a future API.

## Current prototype

Welcome and device readiness, register/login entry, four onboarding steps (personal data, goal, training setup, health and emergency contact), and a generated plan summary. Profile fields are saved automatically to local storage on the current browser/device. There is no server account, remote sync, or live camera monitoring yet.

## Progress report

See [PROGRESS.md](./PROGRESS.md) for the initial onboarding handoff, [PROGRESS-2.md](./PROGRESS-2.md) for Home, [PROGRESS-3.md](./PROGRESS-3.md) for Coach, and [PROGRESS-4.md](./PROGRESS-4.md) for Scan.
