import base from './playwright.routine.config.mjs';
export default { ...base, use: { ...base.use, baseURL:'http://127.0.0.1:3118' },
  webServer:{ command:'npm run dev -- --port 3118',url:'http://127.0.0.1:3118',reuseExistingServer:false,
    timeout:90000,env:{NEXT_DEV_DIST_DIR:'.next-offline-workout-test'} } };
