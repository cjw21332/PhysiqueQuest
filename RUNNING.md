# PhysiqueQuest - System Setup & Running Instructions

This guide provides complete instructions for setting up and running the PhysiqueQuest application across all platforms.

## Exercise library catalog

Coach's Exercise library and `/exercises` use free ExerciseDB V1 through the independent Coach service. Build the backend, then run `npm run coach` from the repository root (or `npm run coach:dev` during development). It listens on port 4050 without MongoDB or other feature modules. The Coach screen loads per-user programs from the authenticated main backend on port 4000 (`npm run start:dev` inside `backend`); this Coach module generates and saves a program once per training-preference version, then reuses MongoDB's `coach_programs` records. Both processes are needed for the full Coach experience. See [AI Coach setup](docs/AI_COACH.md).

The old `npm run seed` and Me's role-protected administrator catalog still manage local legacy records, but these records no longer supply Coach or its public library. They are not a fallback for ExerciseDB errors. GIF demonstrations, instructions and metadata come from ExerciseDB. Missing media remains unavailable; V1 does not certify AI tracking. Analytics remains a separate preview.

## System Architecture

PhysiqueQuest consists of three main components:

```
┌─────────────────┐
│  Expo Go App    │  Mobile Application (native WebView shell)
│  React Native   │
└────────┬────────┘
          │ Loads frontend in WebView
          ▼
┌─────────────────┐
│  Next.js Web    │  Frontend Application
│  Port: 3000     │  http://localhost:3000
└────────┬────────┘
          │ API Calls
          ▼
┌─────────────────┐
│  NestJS API     │  Backend Server
│  Port: 4000     │  http://localhost:4000
└────────┬────────┘
          │ Database Connection
          ▼
┌─────────────────┐
│  MongoDB Atlas  │  Cloud Database
│  PhysiqueQuest  │
└─────────────────┘
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)
- **MongoDB Compass** (optional, for database visualization) - [Download here](https://www.mongodb.com/products/compass)
- **Expo Go App** (for mobile testing) - Download from App Store or Google Play

## Database Configuration

### MongoDB Atlas Connection

The backend uses MongoDB Atlas for cloud database hosting. Connection credentials are stored in `backend/.env` file.

### Connecting with MongoDB Compass

1. Open MongoDB Compass
2. Click **"New Connection"**
3. Get your connection string from `backend/.env` (look for `MONGODB_URI`)
4. Paste the connection string into MongoDB Compass
5. Click **"Connect"**
6. You should see your database in the left sidebar

**Important:** Ensure your IP address is whitelisted in MongoDB Atlas:
- Go to [MongoDB Atlas](https://cloud.mongodb.com)
- Navigate to **Network Access**
- Click **"Add IP Address"** and add your current IP

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd PhysiqueQuest
```

### 2. Install Dependencies

Install dependencies for each component:

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
npm install --workspace frontend
```

**Mobile:**
```bash
npm install --workspace mobile
```

Run workspace install commands from the repository root so npm uses the root
workspace lockfile and the Expo SDK versions declared by the project. Do not use
`npm audit fix --force` to address audit warnings: it can make breaking major
version changes to Expo and React Native that are incompatible with this app.
Review dependency upgrades against the Expo SDK compatibility requirements.

## Running the Application

You need to run all three components simultaneously in separate terminal windows. For Expo Go, all devices must be on the same Wi-Fi network. The Next.js and NestJS servers listen on the computer's network interfaces; the app uses the computer's LAN address for both the page (port 3000) and API (port 4000). MongoDB Atlas remains a cloud database and is reached by the backend, not by the phone.

### Terminal 1: Backend Server

```bash
cd backend
npm run start:dev
```

**Expected Output:**
- NestJS application starting
- MongoDB connection successful
- Server listening on http://localhost:4000

**Available Scripts:**
- `npm run start:dev` - Start in development mode with hot-reload
- `npm run start` - Start in standard mode
- `npm run start:prod` - Start in production mode
- `npm run build` - Build the application

### Terminal 2: Frontend Server

```bash
cd frontend
npm run dev
```

**Expected Output:**
- Next.js compiling
- Ready on http://localhost:3000
- Network address displayed (e.g., http://192.168.1.10:3000)

**Available Scripts:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run linter

### Terminal 3: Mobile App (Optional)

```bash
npm run expo
```

Run this command from the repository root. It invokes the mobile workspace's
local Expo CLI with LAN hosting and an explicit Expo Go launch target (`--go`).
The `start:tracking` mobile script targets a custom development build for native
camera rep counting. Installing `expo-dev-client` does not change the normal
scripts' launch target. From inside `mobile/`, `npm run expo` works as
well. Do not install the deprecated global `expo-cli`.

The repository root also declares `mobile/index.ts` as its Expo entry point, so
starting Expo there no longer searches for a nonexistent root `App`. The mobile
workspace remains the recommended launch location so its app configuration is used.
If an existing session reports `Unable to resolve "../../App"`, stop that Expo
process with Ctrl+C, then restart from the repository root with a clean cache:

```bash
npm run start --workspace mobile -- --clear
```

**Expected Output:**
- Expo DevTools opening in browser
- QR code displayed in terminal
- Development server running

**Available Commands:**
- Press `a` - Open on Android emulator
- Press `i` - Open on iOS simulator
- Press `w` - Open in web browser
- Scan QR code with Expo Go app on your phone

## Accessing the Application

### Web Application
Open your browser and navigate to:
```
http://localhost:3000
```

### Mobile Application (Expo Go)

**Important:** Your phone and computer must be on the same Wi-Fi network.

1. Install **Expo Go** app on your mobile device:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Open Expo Go app

3. Scan the QR code displayed in Terminal 3

4. Expo Go opens the mobile wrapper. On a LAN session, it infers the computer's private IPv4 address and loads `http://[your-computer-ip]:3000`; API requests use the same host at `http://[your-computer-ip]:4000/api`. The app reports frontend and backend connectivity separately.

Expo's tunnel can transport the Expo JavaScript bundle, but it does not expose your computer's Next.js or NestJS server. When using an Expo tunnel, provide the real computer/deployment URLs below or enter the frontend LAN URL on the connection screen. The phone must still be able to reach both ports.

**If the app shows a connection screen:**
- Verify both devices are on the same Wi-Fi network
- Check that the frontend, backend, and MongoDB Atlas connection are running
- Enter your computer's LAN address and port 3000 in the app, for example `http://192.168.1.10:3000` (replace with your actual IP)
- Allow Node.js through Windows Defender Firewall for private networks so the phone can reach ports 3000 and 4000
- If the frontend opens but the backend banner says unavailable, check port 4000 and retry the backend check; this does not require reloading the Expo bundle

### Finding Your Computer's IP Address

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**Mac/Linux:**
```bash
ifconfig
```
or
```bash
ip addr show
```

## Environment Variables

### Mobile URLs (optional)

Leave both values unset for automatic LAN discovery. If the frontend and API are hosted at known reachable addresses, set these in `mobile/.env` before starting Expo:

```env
EXPO_PUBLIC_WEB_APP_URL=http://192.168.1.10:3000
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000/api
```

Replace those example addresses with your actual reachable host. These are public URLs, not credentials. Restart Expo after editing `mobile/.env`. Never place MongoDB, JWT, email, alert-provider, or AI-provider secrets in a mobile environment file; those belong in `backend/.env`.

### Backend (.env)

Create or verify the `backend/.env` file exists with the following variables:

```env
# MongoDB Atlas Connection
MONGODB_URI=your_mongodb_connection_string_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=4000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Optional backend-only providers. Leave blank to show setup/unavailable states.
EMAIL_DELIVERY_URL=
EMAIL_DELIVERY_API_KEY=
ALERT_DELIVERY_URL=
ALERT_DELIVERY_API_KEY=
POSE_ANALYSIS_URL=
POSE_ANALYSIS_API_KEY=
```

**Important:** 
- Replace placeholder values with your actual credentials
- Never commit the `.env` file to version control
- The `.env` file should be listed in `.gitignore`

Email reset, emergency alert delivery, and pose analysis remain unavailable until their URL and API key pairs are set. The provider keys stay in `backend/.env`; never copy them into `mobile/.env` or `frontend/.env`. Admin users must be explicitly provisioned in MongoDB; follow the instructions in [backend/README.md](./backend/README.md#admin-access).

### Mobile (Optional)

If you want to set a fixed frontend URL for mobile, create `mobile/.env`:

```env
EXPO_PUBLIC_WEB_APP_URL=http://YOUR_COMPUTER_IP:3000
```
Replace `YOUR_COMPUTER_IP` with your computer's actual IP address.

## Troubleshooting

### Backend Issues

**Problem:** Backend fails to start
- **Solution:** Check if port 4000 is already in use
  ```bash
  # Windows
  netstat -ano | findstr :4000
  
  # Mac/Linux
  lsof -i :4000
  ```

**Problem:** MongoDB connection error
- **Solution 1:** Verify your IP is whitelisted in MongoDB Atlas Network Access
- **Solution 2:** Check your internet connection
- **Solution 3:** Verify credentials in `.env` file

**Problem:** "bad auth : authentication failed"
- **Solution:** Double-check the username and password in your connection string

### Frontend Issues

**Problem:** Frontend fails to start
- **Solution:** Check if port 3000 is already in use
- **Solution:** Delete `.next` folder and `node_modules`, then reinstall:
  ```bash
  rm -rf .next node_modules
  npm install
  npm run dev
  ```

**Problem:** "Module not found" errors
- **Solution:** Run `npm install` again in the frontend directory

### Mobile Issues

**Problem:** Can't connect to frontend
- **Solution 1:** Ensure phone and computer are on the same Wi-Fi network
- **Solution 2:** Check your computer's firewall settings
- **Solution 3:** Manually enter your computer's IP address in the mobile app

**Problem:** QR code won't scan
- **Solution:** Manually type the URL shown in the Expo DevTools into Expo Go app

**Problem:** App shows white screen
- **Solution 1:** Make sure the frontend server is running
- **Solution 2:** Check the Metro bundler logs in Terminal 3 for errors
- **Solution 3:** Restart Expo by pressing `r` in Terminal 3

## Stopping the Application

To stop any server, press `Ctrl + C` in the respective terminal window.

## Development Workflow

### Making Changes

1. **Backend Changes:**
   - Edit files in `backend/src/`
   - Server automatically restarts (hot-reload enabled)

2. **Frontend Changes:**
   - Edit files in `frontend/`
   - Browser automatically refreshes (Fast Refresh enabled)

3. **Mobile Changes:**
   - Edit files in `mobile/`
   - Expo Go app automatically reloads

### Testing

**Backend Tests:**
```bash
cd backend
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:e2e      # Run end-to-end tests
```

**Frontend Tests:**
```bash
cd frontend
npm run lint          # Run linter
```

## Production Deployment

### Backend

```bash
cd backend
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend
npm run build
npm run start
```

### Mobile

For production mobile app deployment, see [Expo's deployment guide](https://docs.expo.dev/distribution/introduction/).

## Quick Start Commands

For convenience, here's a quick reference:

```bash
# Terminal 1 - Backend
cd backend && npm run start:dev

# Terminal 2 - Frontend  
cd frontend && npm run dev

# Terminal 3 - Mobile (optional)
cd mobile && npx expo start
```

## Ports Summary

- **Backend API:** http://localhost:4000
- **Frontend Web:** http://localhost:3000
- **Expo DevTools:** http://localhost:19002 (or similar)
- **MongoDB Atlas:** Remote (cloud-hosted)

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)

## Expo Go Verification Status

The current checkout was verified on 2026-10-04 with the repository's installed dependencies. From the repository root, `npm run build --workspace frontend` succeeds; from `backend/`, `npm test` passes 219 tests and `npm run build` succeeds; from `mobile/`, `npx tsc --noEmit -p tsconfig.json`, `node --test connection.test.mjs`, `npx expo config --type public`, and Android/iOS `npx expo export` succeed. Frontend behavior tests (`node --test frontend/tests/*.test.mjs`) pass 36 tests, and `npm run test:ui-guard --workspace frontend` passes 14 tests.

The live LAN smoke check reached the running Expo Metro server on port 8081, frontend on port 3000, and backend on port 4000 from this computer. API/CORS requests passed, MongoDB-backed writes were confirmed by fresh authenticated reads, and a second account was denied access to the first account's records. Temporary smoke-test accounts and their records were removed after the run. Android and iOS JavaScript bundles each exported successfully; a bundle scan found no backend credential names.

This environment has no available Android Debug Bridge or controllable Expo Go device, so on-phone QR loading, touch interaction, camera permission prompts, and phone-to-computer Wi-Fi reachability have not been exercised. Email delivery, emergency alert delivery, and pose analysis also remain unavailable until their backend provider URL/key pairs are configured. The API correctly reports these services as unavailable; configure the backend-only provider variables above to enable them. Successful exports and same-computer LAN checks do not substitute for those device/provider checks.



## Mobile (Expo Go) - WebView Shell

- App.tsx retains the native WebView shell, device readiness, camera permission bridge, and connection recovery
- .npmrc added with allow-scripts=true
- Backend CORS enabled; API uses LAN IP 192.168.100.5
- Start: npm run start:dev (backend) / npm run dev (frontend) / npx expo start --lan (mobile)
