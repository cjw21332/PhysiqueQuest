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

The Expo app opens the live Next.js app in a native WebView. Changes to the web app appear on the phone as you work. The WebView infers the computer address from the Expo connection, and API requests use that same LAN host on port 4000. If your phone cannot connect, make sure both devices are on the same network, allow Node.js through the private-network firewall, and enter the computer's LAN address with `:3000` on the connection screen. Expo's tunnel can carry the Expo bundle, but your phone still needs network access to ports 3000 and 4000.

## Folders

- `frontend/app/` — Next.js app entry point and responsive styling.
- `frontend/sections/Auth/` — registration and login screens.
- `frontend/sections/Home/` — dashboard, bottom navigation, goals, progress, notifications, and shared Home icons.
- `frontend/sections/Coach/` — coach plan, exercise library, camera check, live session, and workout report.
- `frontend/sections/Scan/` — nutrition overview, meal review, manual food entry, daily log, and history.
- `frontend/sections/Quests Section/` — level and streak progress, daily missions, penalty rules, and badges.
- `frontend/sections/Me Section/` — profile summary, safety preferences, privacy controls, and account settings.
- `mobile/` — Expo Go companion that opens the live Next.js app in a native WebView.
- `backend/` — NestJS authentication and profile API with MongoDB persistence.

## Current prototype

Registration and login use the backend and MongoDB Atlas for accounts and profiles. The four onboarding steps collect personal data, goals, training setup, and health/emergency contact information. Unit selections are persisted alongside raw measurement values. Other features such as nutrition history, quests, workout tracking, and password reset still include prototype/local behavior; live camera/form tracking is not implemented.

## Progress report

See [PROGRESS.md](./PROGRESS.md) for the initial onboarding handoff, [PROGRESS-2.md](./PROGRESS-2.md) for Home, [PROGRESS-3.md](./PROGRESS-3.md) for Coach, [PROGRESS-4.md](./PROGRESS-4.md) for Scan, [PROGRESS-5.md](./PROGRESS-5.md) for Quests, and [PROGRESS-6.md](./PROGRESS-6.md) for Me.

See [progress-10.md](./progress-10.md) and [PROGRESS-11.md](./PROGRESS-11.md) for backend integration, unit-aware profile persistence, and Expo Go improvements.
