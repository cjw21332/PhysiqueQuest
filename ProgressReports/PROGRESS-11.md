# Progress Report 11 — PhysiqueQuest v2.1.0

**Date:** October 3, 2026
**Branch:** `PhysiqueQuest-v2.1.0`
**Status:** Mobile LAN access, authenticated profile integration, and unit-aware profile persistence updated

## Summary

This report records the full system work carried through the v2.1.0 milestone: the four-step registration experience, unit-aware personal data, MongoDB-backed authentication and profiles, Expo Go connectivity, and the white-screen/navigation fixes.

## Registration and personal data

- The registration flow collects account details and consent, then guides a new user through four steps: Personal data, Goals, Training preference, and Health & safety.
- Height has an inline unit selector for `cm` and `ft & in.`; weight uses `kg` and `lbs`; chest, waist, and arm values each have their own `cm` or `inch` selector in the input suffix area.
- Changing height or weight units converts the displayed value. Weight-unit changes also convert the target weight. BMI and measurement validation normalize values for calculation while preserving the entered values and unit selections for display and persistence.
- Step progress, back/next navigation, field validation, and the registration action layout were refined for mobile sizing and alignment.
- Password feedback and Philippine mobile-number formatting are included in the registration flow.

## Backend, authentication, and MongoDB

- The NestJS backend connects to MongoDB Atlas and exposes registration/login endpoints plus authenticated profile create/read/update/delete endpoints.
- Registration creates the account after the full calibration flow; the returned JWT authorizes profile creation. Login uses the backend credentials and JWT response. Authenticated app pages load the profile from the API and cache the response locally.
- MongoDB profile documents preserve `heightUnit`, `weightUnit`, and the independent `chestUnit`, `waistUnit`, and `armsUnit` values. Backend DTOs validate units and profile-service bounds use each selected unit for its measurement.
- The optional legacy `measurementUnit` field remains supported as a fallback for older shared-unit profiles. New clients send the per-measurement fields.
- The backend listens on all network interfaces for local-device access. Development CORS accepts the frontend LAN origin on port 3000; the Expo WebView uses the same computer host for the API on port 4000.
- Secrets and the MongoDB URI remain server-side in the backend environment; the phone never connects to Atlas directly.

## Expo Go and navigation

- The Expo WebView discovers its host from Expo Go, removes a stale hard-coded IP fallback, and offers a manual computer-address entry when the frontend cannot be reached.
- The frontend API client derives its LAN API address from the loaded page host, avoiding `localhost` on a physical phone.
- The initial `/` request now redirects server-side to the launch page. The launch page is server-rendered instead of returning `null` until hydration, and protected pages render their loading/error state while profile/auth checks complete. This removes the client-only splash handoff that could leave Expo Go on a blank screen.
- The authenticated home, coach, scan, quests, and profile routes use their actual URL paths. Profile loading failures show a retry state rather than an empty screen.
- `RUNNING.md`, `README.md`, and the persistence/development rules now describe the frontend, Expo Go, backend, LAN ports, and database behavior consistently.

## Current boundaries

- Page-to-page navigation is handled by the Next.js frontend. Authentication and profile persistence are handled by the API; the backend does not render or navigate screens.
- Forgot-password UI exists, but a password-reset API, email verification, and reset challenge are not implemented yet.
- Nutrition logs, workout/quest progress, and several coach/camera behaviors remain local, sample, or prototype behavior; these are not all persisted through the backend.
- Local development uses HTTP on a trusted LAN. Production deployment still needs HTTPS and operational security/backup review.

## Verification

- Frontend production build completed successfully with TypeScript and route generation.
- Backend Nest build completed successfully.
- Expo TypeScript check and Android JavaScript bundle completed successfully.
- The LAN root responds with a `307` redirect to `/launch`; launch/login/register and signed-in route pages respond successfully, and frontend static assets return `200`.
- A preflight from `http://192.168.100.5:3000` to the backend returns `204` with the matching CORS origin. The protected profile endpoint returns `401` without a token, confirming the route is reachable and remains guarded.
- MongoDB initialized successfully in the backend startup log. Expo Go reported the WebView loading the computer's LAN frontend URL. A complete registration/login interaction was not automated during this update.

## Run the integrated system

1. Configure `backend/.env` with MongoDB and JWT settings.
2. Start the backend from `backend/` with `npm run start:dev`.
3. Start the frontend from the repository root with `npm run dev`.
4. Start Expo Go with `npm run expo`; keep the phone and computer on the same reachable Wi-Fi network and allow Node.js through the private-network firewall.
5. Scan the Expo QR code. The wrapper loads the frontend on port 3000 and uses the same LAN host for the API on port 4000.

---

**End of Progress Report #11**
