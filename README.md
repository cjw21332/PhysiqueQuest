# PhysiqueQuest

A responsive, mobile-first fitness onboarding prototype based on the supplied design references. The project is split into `frontend/` and `backend/` so each part has a clear place to grow.

## Run locally

Install dependencies with `npm install`, then start the app with `npm run dev`. Open the local address shown in the terminal. The same responsive app works in phone, tablet, and desktop browsers.

## Run on a phone with Expo Go

1. Install dependencies with `npm install` from the project root.
2. Start the live web app with `npm run dev` in one terminal.
3. Start the Expo Go bridge with `npm run expo` in a second terminal.
4. Connect your phone and computer to the same Wi-Fi, install or update Expo Go, and scan the Expo terminal QR code.

The Expo app opens the live Next.js app in a native WebView. Changes to the web app appear on the phone as you work. The WebView can infer the computer address from the Expo connection; if your phone cannot connect, make sure both devices are on the same network and enter the computer's LAN address with `:3000` on the connection screen. Expo's tunnel can carry the Expo bundle, but your phone still needs network access to the web app on port 3000.

## Folders

- `frontend/app/` — Next.js app entry point and responsive styling.
- `frontend/sections/Auth/` — registration and login screens.
- `frontend/sections/Home/` — dashboard, bottom navigation, goals, progress, notifications, and shared Home icons.
- `frontend/sections/Coach/` — coach plan, exercise library, camera check, live session, and workout report.
- `frontend/sections/Scan/` — nutrition overview, meal review, manual food entry, daily log, and history.
- `frontend/sections/Quests Section/` — level and streak progress, daily missions, penalty rules, and badges.
- `frontend/sections/Me Section/` — profile summary, safety preferences, privacy controls, and account settings.
- `mobile/` — Expo Go companion that opens the live Next.js app in a native WebView.
- `backend/` — handoff notes and reserved location for a future API.

## Current prototype

Welcome and device readiness, register/login entry, four onboarding steps (personal data, goal, training setup, health and emergency contact), and a generated plan summary. Profile fields are saved automatically to local storage on the current browser/device. There is no server account, remote sync, or live camera monitoring yet.

## Progress report

See [PROGRESS.md](./PROGRESS.md) for the initial onboarding handoff, [PROGRESS-2.md](./PROGRESS-2.md) for Home, [PROGRESS-3.md](./PROGRESS-3.md) for Coach, [PROGRESS-4.md](./PROGRESS-4.md) for Scan, [PROGRESS-5.md](./PROGRESS-5.md) for Quests, and [PROGRESS-6.md](./PROGRESS-6.md) for Me.
