# Expo Go Connectivity Implementation Plan

> **For agentic workers:** Use the selected plan-execution workflow task-by-task. Each step uses checkbox syntax for tracking.

**Goal:** Make the current Expo Go WebView reliably load the frontend and use the matching backend host on a phone.

**Architecture:** Keep the React Native WebView shell. Centralize frontend/API host resolution, probe backend reachability from a source that uses the same resolved API base, and preserve manual recovery and safe-area/readiness messaging. Do not treat Expo's bundle tunnel host as the application server.

**Tech Stack:** Expo SDK 57, React Native 0.86, `react-native-webview`, Next.js 16, NestJS 12, TypeScript, Node built-in test runner, existing Vitest setup.

**Spec:** [Expo Go End-to-End Reliability Design](../expo-go-reliability-design.md)

## Global Constraints

- Keep Expo Go as a WebView shell; do not introduce native screens.
- Do not add dependencies without approval.
- Keep ports 3000 (frontend) and 4000 (backend), and bind development servers for LAN access.
- Do not reset or replace the existing staged changes; build on the current checkout.
- Keep backend secrets out of mobile/frontend bundles.

## Review Focus

- Expo tunnel URI is not the LAN API host; use an explicit frontend/API pair and do not silently infer the wrong host.
- IPv4 private LAN host and port parsing must preserve a user-entered URL with or without a scheme.
- Frontend reachable while API is down must show backend-only status and permit retry without reloading the app.
- Backend CORS preflight must accept the actual Expo-loaded frontend origin on port 3000 and reject arbitrary origins.
- Android cleartext HTTP behavior in Expo Go must be diagnosed without relying on native config changes that Expo Go cannot consume.

---

### Task 1: Centralize Expo frontend and API address resolution

**Files:**
- Create: `mobile/connection.mjs`, `mobile/connection.d.mts`
- Create: `mobile/connection.test.mjs`
- Modify: `mobile/App.tsx`
- Test: `mobile/connection.test.mjs`

**Interfaces:**
- `normalizeFrontendUrl(input: string): string | null`
- `resolveFrontendUrl(configuredUrl: string | undefined, hostUri: string | undefined): string | null`
- `resolveApiUrl(configuredApiUrl: string | undefined, frontendUrl: string): string | null`
- Keep helpers pure with no Expo/React Native imports so Node's built-in test runner can load them.

- [ ] Add Node tests for configured HTTPS URL, LAN host URI, tunnel host URI with no configured frontend address, manual address with omitted scheme, trailing slash, invalid URL, and configured API URL.
- [ ] Run `node --test mobile/connection.test.mjs`; confirm missing helpers fail the import before implementation.
- [ ] Implement the pure helpers using `URL`; infer `http://<host>:3000` only from a numeric private IPv4 Expo host URI. Return `null` for an Expo tunnel hostname.
- [ ] Update `mobile/App.tsx` to use the helpers, retain manual entry, and show a connection screen when resolution returns `null`.
- [ ] Run `node --test mobile/connection.test.mjs` and `npx tsc --noEmit -p mobile/tsconfig.json`.

### Task 2: Make frontend API calls use the resolved/configured API origin

**Files:**
- Modify: `frontend/lib/api.ts`
- Create: `frontend/lib/apiBaseUrl.mjs`, `frontend/lib/apiBaseUrl.d.mts`, `frontend/lib/apiErrors.mjs`, `frontend/lib/apiErrors.d.mts`
- Modify: `frontend/next.config.ts` only if required to expose a public runtime value
- Create: `frontend/tests/api-base-url.test.mjs`, `frontend/tests/api-client-errors.test.mjs`
- Test: `frontend/tests/api-base-url.test.mjs`, `frontend/tests/api-client-errors.test.mjs`

**Interfaces:**
- `getApiBaseUrl(): string` uses `NEXT_PUBLIC_API_URL` when set; otherwise it resolves from the loaded page hostname on port 4000 and defaults to localhost only in non-device contexts.
- Mobile configuration may pass a public API URL into the WebView, never a secret.

- [ ] Add Node tests pinning configured API precedence, LAN page-host derivation, `/api` suffix behavior, SSR fallback, and network-versus-HTTP error classification.
- [ ] Run `node --test frontend/tests/api-base-url.test.mjs` and capture failing assertions for missing runtime handling.
- [ ] Update API base resolution and the WebView injection contract so the frontend gets the explicit public API base when configured and otherwise derives from the frontend host on port 4000.
- [ ] Preserve HTTP status in request errors and distinguish unreachable backend from an HTTP response; never log tokens or request bodies.
- [ ] Run `node --test frontend/tests/api-base-url.test.mjs frontend/tests/api-client-errors.test.mjs` and `npm run test:ui-guard --workspace frontend`.

### Task 3: Probe the configured backend and align CORS diagnostics

**Files:**
- Modify: `mobile/App.tsx`
- Modify: `backend/src/main.ts`
- Create: `backend/test/mobile-cors.spec.ts`
- Modify: `README.md`
- Modify: `RUNNING.md`
- Test: `backend/test/mobile-cors.spec.ts`

**Interfaces:**
- Expo WebView posts `{ type: 'backend-status', ok, status? }` based on a GET to the configured API base, not a separately reconstructed hostname.
- CORS accepts no-origin native requests, configured `FRONTEND_URL` origins, and only HTTP private-LAN origins on port 3000 during development.

- [ ] Add CORS tests for allowed configured origin, allowed RFC1918 development origin on port 3000, denied public origin, denied wrong port, and production rejection of unconfigured LAN origin.
- [ ] Run `npm test -- --run test/mobile-cors.spec.ts` from `backend/`.
- [ ] Update backend status probing to use the API URL injected by the mobile shell; set status to `checking` before each probe and preserve retry.
- [ ] Ensure API probe failure leaves the WebView loaded with only the backend warning; frontend load failure keeps manual address recovery.
- [ ] Update run instructions with LAN URL pair, required ports, firewall note, and the fact that Expo bundle tunneling does not tunnel frontend/API servers.
- [ ] Run the focused CORS test and `npm run build` from `backend/`.

### Task 4: Verify the Expo Go connection path

**Files:**
- Modify: `mobile/App.tsx` only for defects found by checks.
- Test: Expo config, TypeScript, iOS and Android export; no new test dependencies.

- [ ] Run `npx expo config --type public` from `mobile/` and confirm Expo SDK 57, WebView compatibility, scheme, and permission config.
- [ ] Run `npx tsc --noEmit -p tsconfig.json` from `mobile/`.
- [ ] Run `npx expo export --platform android --output-dir .expo/export-android` and `npx expo export --platform ios --output-dir .expo/export-ios` from `mobile/`; fix source errors and rerun. Keep generated bundles under the already-ignored `.expo/` directory.
- [ ] Start frontend/backend on LAN and verify from a second LAN client that frontend root redirects, backend `/api` is reachable, and OPTIONS from the frontend origin returns 204 with matching CORS headers.
- [ ] Exercise the installed Expo Go app when the attached device is reachable. Record frontend/backend status separately; if no device can be controlled, report that limit rather than claiming device verification.

## Completion

Connectivity is complete when Tasks 1–4 pass and Expo Go uses the same reachable host for frontend/backend, with separate recoverable UI states for each outage.
