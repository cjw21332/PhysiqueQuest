# Android public preview

The Android `preview` EAS profile produces an installable APK with bundled JavaScript. It does not require Expo Go or Metro. Its web interface and API still run on the PC.

## Separate local Expo Go and installed APK

The installed preview APK keeps its packaged public address and uses the
public preview services on ports 3100, 4100 and 4150. The `preview` build
profile explicitly disables the Expo Go local-server mode. Existing installed
APKs are not modified by changes to this checkout.

For local testing, run `npm run expo` from the repository root. It launches
Expo Go in local mode and discovers the computer's LAN address for the web app
on port 3000, with API and Coach requests proxied to ports 4000 and 4050.
Run `npm run dev`, `npm run coach:dev`, and `npm run start:dev` from `backend`
in separate terminals. Restart Expo and rescan its QR code after changing the
local configuration. If discovery fails, enter `http://<computer-LAN-IP>:3000`
on the connection screen; the phone and computer need network access to one
another. The APK can remain installed and the preview services can remain on.

These separate processes currently use the same `backend/.env` by default.
Use independently configured databases if test accounts or writes must be
isolated from preview data. Do not assume separate ports isolate the database.

The current temporary HTTPS address is stored in `mobile/app.json` and the ignored `mobile/.env`. The installed app can also change the address from its connection screen; changing it updates both the website and API URL. The API uses the same HTTPS origin with `/api`; the local AI and database are not directly published by the tunnel.

## Running services

- Cloudflare Tunnel forwards public HTTPS to loopback port 3100.
- The built Next application on 3100 proxies API requests to 4100 and coach requests to 4150.
- Backend and coach use the existing local backend configuration and database. The preview adds an exact public CORS origin and secure session cookies.
- Ollama must remain running for local AI.
- Process IDs, build status, and diagnostic logs are stored in ignored `.tools/`.

`scripts/start-public-preview.mjs` starts isolated preview servers. It expects a running tunnel and a frontend build made with `BACKEND_URL=http://127.0.0.1:4100` and `COACH_BACKEND_URL=http://127.0.0.1:4150`. Do not run duplicate preview processes. The `--web-only` option is for restarting only the web server after rebuilding it.

On Windows PowerShell, `2> .tools/tunnel.log` may write UTF-16 output; the preview launcher handles both UTF-16 and UTF-8 logs. Start the tunnel first and leave its terminal running before starting the preview services. A log entry can remain after the tunnel has stopped, so the launcher finding a URL does not itself mean the tunnel is still online.
Before starting the preview, ports 3100, 4100, and 4150 must be free. If the launcher says a preview process is already running or a port is occupied, do not start a duplicate; find the terminal running the old PhysiqueQuest service and stop it there. Avoid terminating an unidentified Node process.

### Start from PowerShell

1. Start Ollama from the Start menu if you use the local AI coach.
2. In the first PowerShell window, run this from the repository root and leave the window open:

   ```powershell
   cd "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest"
   .\.tools\cloudflared.exe tunnel --url http://127.0.0.1:3100 --protocol http2 --no-autoupdate 2> .tools\tunnel.log
   ```

3. In a second PowerShell window, run:

   ```powershell
   cd "C:\Users\MY PC\Desktop\Projects\PhysiqueQuest"
   node scripts/start-public-preview.mjs
   ```

   The launcher waits briefly for Cloudflare to print its HTTPS URL. It then starts the frontend, backend, and coach services in the background. Keep the tunnel window open; the PC must stay awake and connected to the internet. The second command exits after printing the preview address.
4. On the phone, install the current preview APK. If it reports that the backend is unavailable, tap **Change server** and enter the exact `https://…trycloudflare.com` address printed by the startup script. Do not append `/api`.

Quick Tunnel addresses change after a tunnel restart. The app can switch to a new address without another APK build, but a manually entered address is not saved across app restarts. Enter the new address again after relaunch or a tunnel restart. The URL in the APK defaults to the tunnel active when that APK was built.

Use `node scripts/check-android-build.mjs BUILD_UUID` to check an EAS build and download its completed APK into `artifacts/android/PhysiqueQuest-preview.apk`.

## Limits and phone checks

This is a temporary internet-accessible testing setup, not an approved production deployment. The backend deliberately retains development configuration because production validation requires additional storage and security configuration. No production validation was bypassed.

A Quick Tunnel hostname changes when the tunnel is restarted. Keep the PC awake, connected, and the tunnel running. After a hostname change, update the mobile connection and exact server origin configuration; an APK embedding the old address will not automatically discover the new address. A durable release needs a stable hostname and supervised server processes.

On a physical Android phone with Wi-Fi off, test installation, login, new Google registration/password/OTP/profile completion, interrupted registration recovery, push permission and delivery, local AI requests, and camera tracking. Automated build and API checks cannot establish physical-device behavior or complete production readiness.

## Checks completed on November 12, 2026

- Public HTTPS `/login`, `/register`, `/health`, and `/ready` returned 200.
- Unauthenticated refresh and AI status requests returned 401; a foreign session origin was rejected (currently with 500 rather than a clean 403).
- Refresh cookie attributes included HttpOnly, Secure, and SameSite=Lax.
- Both auth pages loaded at 390 × 844 with no horizontal overflow or browser page errors; each contained one Google action.
- Mobile TypeScript checking and 15 camera/Metro tests passed.
- Twelve Google authentication backend tests passed.
- The Firebase Android OAuth certificate matches the EAS signing certificate.
- EAS build `f18059dd-8ca8-4a0f-b963-65f299975177` successfully bundled 1,583 Android modules and passed release signing/lint checks.
