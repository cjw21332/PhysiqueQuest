# Task 7 acceptance — 4 November 2026

## A. Acceptance Summary

**PARTIAL PASS.** Automated regression, real MongoDB service integration, and live Open Food Facts checks passed. Physical-device acceptance is pending. The user elected to test on their phone later. No physical scans or normal mobile sign-ins are claimed.

## B. Device and Browser Information

- Physical device, OS and browser/version: NOT TESTED; no Android device appeared in `adb devices -l`.
- Automated browser: desktop Chromium via the existing Playwright configuration, 390 × 844 viewport, synthetic camera stream and mocked account/API responses.
- Host: Windows; LAN IPv4 `192.168.100.5` at verification time.
- Frontend: port 3000, development server binds all interfaces; `/api` proxies to `http://127.0.0.1:4000/api`.
- Backend started for this acceptance session on **127.0.0.1:4000**, using the normal application initialization and configured database. Standard `main.ts` otherwise binds all interfaces; the command below intentionally limits this test instance to loopback.
- Local MongoDB service: running, configured to bind only `127.0.0.1:27017`. Integration tests use randomly named isolated databases and remove only their own database. The normal app uses its existing configured connection; it is not switched to the integration-test database.
- HTTPS: not configured or tested on a phone. LAN HTTP is suitable for checking connectivity, not camera acceptance. USB forwarding and trusted HTTPS instructions follow.

## C. Barcode Format Results

| Format | Physical scan | Correct detection | Lookup | Result |
|---|---|---|---|---|
| EAN-13 | NOT TESTED | Synthetic Quagga EAN-13 passed only | Live service lookup passed for 3017620422003 | Physical NOT TESTED |
| EAN-8 | NOT TESTED | Validation unit test only | Physical NOT TESTED | NOT TESTED |
| UPC-A | NOT TESTED | Validation unit test only | Physical NOT TESTED | NOT TESTED |
| UPC-E | NOT TESTED | Explicit-format expansion unit test only | Physical NOT TESTED | NOT TESTED |

## D. Camera Lifecycle

Code inspection confirmed environment-facing camera request, inline playback, permission error messaging, manual fallback, cancellation handling and effect cleanup. The synthetic EAN-13 test confirmed decoding and stopped tracks when review opens. A real defect was found: playback rejection after acquiring a stream left tracks active until unmount. The catch handler now stops those tracks immediately; a browser regression confirms cleanup and manual-entry availability.

Permission grant/deny/revoke, busy hardware, repeated navigation, duplicate physical detections, native BarcodeDetector and real portrait usability remain phone checks. Synthetic results do not establish physical-device behavior.

## E. Live Product Lookup

The built **ProductService and HttpService**, using their real outbound request and normalization, retrieved barcode `3017620422003`: Nutella; brands Nutella, Ferrero; package 400 g. Source ingredients were `sugar, palm oil`; allergens were milk, nuts, soybeans. These are upstream data, not independently verified label contents.

| Per 100 g | Returned value |
|---|---:|
| Calories | 539 kcal |
| Protein | 6.3 g |
| Carbohydrates | 57.5 g |
| Total fat | 30.9 g |
| Saturated fat | 10.6 g |
| Fiber | 0 g |
| Total sugars | 56.3 g |
| Added sugars | 52.13 g |
| Sodium | 0.0428 g |
| Trans fat | null |
| Cholesterol | null |

The response itself covers missing and genuine zero values. No serving quantity was supplied, so the normalized serving remains null. A live lookup of `0000000000000` returned NOT_FOUND, “Product not found in Open Food Facts.” Unit tests cover invalid formats, malformed responses, cache expiry and retry after failure. Actual phone offline/timeout/upstream-failure recovery remains untested.

## F. Diary End-to-End Verification

PC probes returned HTTP 200 for localhost and LAN login pages and proxied `/ready`; unauthenticated proxied barcode lookup returned 401. These establish PC-side routing and retained authentication, not phone connectivity or signed-in acceptance.

The client uses same-origin `/api`, access tokens and credentials-included requests. Refresh cookies remain httpOnly, path `/api`, SameSite=Lax; current HTTP development settings use Secure=false. HTTPS instructions set Secure=true and explicitly allow the HTTPS origin. No authentication bypass was added.

Browser tests use account/API mocks and check reviewed manual save values. The separate MongoDB integration uses the real schema/service to write, read and edit records. The continuous physical-camera → normal sign-in → live lookup → confirmed save → configured database → diary reload chain is **NOT TESTED**. No existing account data was modified for this report.

## G. Manual Nutrition Entry

Existing UI supports 100 g/ml, serving and package bases. The browser test verifies 250 kcal, 0 g protein, blank carbs/fat and 4 g fiber per 100 units become 375 kcal, 0 protein, null carbs/fat and 6 fiber for 150 units. MongoDB integration checks nullable/zero values, additional nutrient persistence and preservation after a name edit, then an explicit nutrient edit. Actual phone entry, edit and reload remain pending.

## H. Tests and Builds

| Check rerun in this acceptance pass | Result |
|---|---|
| Backend focused foodscan/activity/diary suites | 67 passed, 6 files; baseline unchanged |
| Frontend photo/aggregation/history regressions | 6 passed; baseline unchanged |
| Existing manual nutrition and Quagga browser tests | 2 passed; baseline unchanged |
| New playback-failure browser regression | 1 passed |
| Isolated MongoDB nullable diary integration | 1 passed, including new edit-preservation assertions |
| Frontend `tsc --noEmit` | Passed |
| Backend `tsc --noEmit` | Passed |
| Frontend production build | Passed |
| Backend production build | Passed |

The first new browser-test run had an ambiguous alert locator because Next also renders an alert. Scoping it to the camera dialog fixed the test; the rerun passed. No assertion was removed. Existing module-type and tsconfig-path plugin warnings remain non-fatal.

## I. Files Modified in This Acceptance Pass

- `frontend/sections/Scan/FoodCamera.tsx`: stop acquired camera tracks when playback fails.
- `frontend/tests/browser/auth-nutrition-harden.spec.mjs`: playback-failure cleanup/manual fallback regression.
- `backend/test/nullable-diary.e2e-spec.ts`: verify nulls, zeros and fiber survive a normal edit/read cycle.
- `ProgressReports/TASK-7-PHYSICAL-ACCEPTANCE.md`: this evidence record and phone handoff.

All other pre-existing working-tree changes were preserved. No production configuration or database migration was changed.

## J. Remaining Limitations and Phone Setup

The frontend and backend were started during this session. If they have stopped, use two PowerShell terminals. Do not start a duplicate server on an occupied port.

### 1. Start backend — terminal one

```powershell
Set-Location 'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\backend'
rtk npm run build
rtk proxy node --input-type=module -e "import {createApplication} from './dist/application.js'; const app=await createApplication(); await app.listen(4000,'127.0.0.1');"
```

This uses existing `backend/.env` and normal authentication. Use a controlled test account when saving acceptance entries. Backend and database ports need no inbound LAN firewall rules.

### 2. Start frontend — terminal two

```powershell
Set-Location 'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\frontend'
$env:BACKEND_URL='http://127.0.0.1:4000'
$env:NEXT_PUBLIC_API_URL=''
rtk npm run dev -- --port 3000
```

Connectivity-only LAN URL: **http://192.168.100.5:3000/login**. It returned 200 from this PC. Reachability from another device, Wi-Fi isolation and Windows firewall remain unverified.

### 3a. Android USB camera route

Connect the phone, enable USB debugging and accept this PC's debugging prompt. Then run:

```powershell
rtk proxy 'C:/Users/MY PC/AppData/Local/Android/Sdk/platform-tools/adb.exe' devices -l
rtk proxy 'C:/Users/MY PC/AppData/Local/Android/Sdk/platform-tools/adb.exe' reverse tcp:3000 tcp:3000
```

Open **http://localhost:3000/login** in Android Chrome on the phone. Loopback is a potentially trustworthy browser origin; USB forwarding avoids LAN TLS setup. Keep the cable attached. Sign in normally and grant camera permission. Do not use the LAN HTTP URL for this camera test. After testing:

```powershell
rtk proxy 'C:/Users/MY PC/AppData/Local/Android/Sdk/platform-tools/adb.exe' reverse --remove tcp:3000
```

[Chrome's USB forwarding documentation](https://developer.chrome.com/docs/devtools/remote-debugging/local-server) also provides a DevTools forwarding UI.

### 3b. Trusted LAN HTTPS alternative

Install mkcert from its [official Windows installation instructions](https://github.com/FiloSottile/mkcert#installation). Then, in a fresh PowerShell terminal:

```powershell
$pqCertDir=Join-Path $env:LOCALAPPDATA 'PhysiqueQuest-dev-cert'
New-Item -ItemType Directory -Force -Path $pqCertDir | Out-Null
rtk proxy mkcert -install
rtk proxy mkcert -key-file "$pqCertDir/lan-key.pem" -cert-file "$pqCertDir/lan.pem" 192.168.100.5 localhost 127.0.0.1
rtk proxy mkcert -CAROOT
```

Transfer only `rootCA.pem` from the printed CA directory to your phone through a trusted transfer. Install it as a CA certificate in Android security settings; on iOS install its profile and enable full trust under Certificate Trust Settings. Names vary by OS. Never transfer `rootCA-key.pem` or `lan-key.pem`. The phone must trust the issuing CA before testing; do not bypass certificate warnings. See [mkcert mobile trust instructions](https://github.com/FiloSottile/mkcert#mobile-devices).

Stop the HTTP frontend and backend with Ctrl+C in their own terminals. Before running the backend command from step 1 again, set in that terminal:

```powershell
$env:FRONTEND_URL='https://192.168.100.5:3000'
$env:CORS_ALLOWED_ORIGINS='https://192.168.100.5:3000,https://localhost:3000,http://localhost:3000'
$env:COOKIE_SECURE='true'
$env:COOKIE_SAMESITE='lax'
```

Start the HTTPS frontend in terminal two:

```powershell
Set-Location 'C:\Users\MY PC\Desktop\Projects\PhysiqueQuest\frontend'
$pqCertDir=Join-Path $env:LOCALAPPDATA 'PhysiqueQuest-dev-cert'
$env:BACKEND_URL='http://127.0.0.1:4000'
$env:NEXT_PUBLIC_API_URL=''
rtk npm run dev -- --port 3000 --experimental-https --experimental-https-key "$pqCertDir/lan-key.pem" --experimental-https-cert "$pqCertDir/lan.pem"
```

Phone URL: **https://192.168.100.5:3000/login**. Connect to the same trusted LAN. If Windows blocks access, allow only frontend TCP 3000 on the Private profile for LocalSubnet; no database/backend rule is needed. These HTTPS steps are prepared but were not executed or trusted on a physical device. If the PC's address changes, regenerate the certificate and update the origin/URL. Restart fresh terminals to discard temporary environment overrides when done; remove the test CA from your phone after testing.

### Phone checklist — results still required

1. Record phone model, OS and browser version, URL and whether the browser reports a secure context. Sign in normally with a controlled account.
2. Scan physical EAN-13, EAN-8, UPC-A and UPC-E samples. Record printed code, detected code/format, lookup result and correct UPC-E expansion. Use the explicit UPC-E selector for manual eight-digit entry. An unknown physical sample can prove detection, but not a successful product lookup.
3. Check permission allow/deny/revoke; scan, cancel, navigate away, return and reopen. Confirm camera indicator turns off, one lookup occurs per scan, and portrait controls remain usable.
4. Scan physical Nutella `3017620422003`; review actual source values, choose quantity/meal and save once. Open Today's Log, inspect the entry, reload, edit, reload and check Food History.
5. Enter a clearly named acceptance label manually: per 100 g, 250 kcal, protein 0, carbs/fat blank, fiber 4; consume 150 g. Confirm 375 kcal, protein 0, carbs/fat unavailable and fiber 6. Save, reload, edit its name only, save and reload again.
6. Check unknown barcode, loss of network and retry/manual recovery. Record timeout/upstream-failure scenarios separately if reproducible; do not mark unobserved cases passed.
7. Return the outcomes, test entry names/IDs, date, quantities and failures. Do not send credentials or tokens. With the exact test record identified, the configured MongoDB record can be inspected read-only to close the persistence evidence gap. Do not delete unrelated records.

## K. Final Acceptance Decision

**Physical-device acceptance is not complete.** Automated checks pass and the application is prepared for the user's later test. All physical format, permission, normal mobile authentication and continuous end-to-end results remain pending. Task 8 has not begun.
