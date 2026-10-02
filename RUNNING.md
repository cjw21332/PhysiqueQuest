# PhysiqueQuest - System Setup & Running Instructions

This guide provides complete instructions for setting up and running the PhysiqueQuest application across all platforms.

## System Architecture

PhysiqueQuest consists of three main components:

```
┌─────────────────┐
│  Expo Go App    │  Mobile Application (WebView wrapper)
│  React Native   │
└────────┬────────┘
         │ Loads
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
cd frontend
npm install
```

**Mobile:**
```bash
cd mobile
npm install
```

## Running the Application

You need to run all three components simultaneously in separate terminal windows.

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
cd mobile
npx expo start
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

4. The app will automatically connect to your frontend at `http://[your-computer-ip]:3000`

**If Connection Fails:**
- Verify both devices are on the same Wi-Fi network
- Check that the frontend server is running
- The app will display an error screen with an input to manually enter the computer address
- Enter your computer's IP address and port: `http://192.168.1.10:3000` (replace with your actual IP)

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
```

**Important:** 
- Replace placeholder values with your actual credentials
- Never commit the `.env` file to version control
- The `.env` file should be listed in `.gitignore`

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

## Support

If you encounter any issues not covered in this guide:

1. Check the terminal logs for error messages
2. Verify all prerequisites are installed
3. Ensure all environment variables are correctly set
4. Check that no other applications are using ports 3000 or 4000

---

**Last Updated:** October 2, 2026
