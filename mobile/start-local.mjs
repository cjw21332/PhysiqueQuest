import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

// A local Expo session must not inherit the deployed app URLs from mobile/.env.
// Explicit development overrides remain available for tunnels and emulators.
const env = {
  ...process.env,
  EXPO_PUBLIC_PQ_LOCAL_DEV: '1',
  EXPO_PUBLIC_WEB_APP_URL: process.env.PQ_DEV_WEB_APP_URL || '',
  EXPO_PUBLIC_API_URL: process.env.PQ_DEV_API_URL || '',
};
const require = createRequire(import.meta.url);
const cli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, [cli, 'start', ...process.argv.slice(2), '--lan'], {
  cwd: import.meta.dirname,
  env,
  stdio: 'inherit',
});
child.on('error', error => { console.error(`Could not start Expo: ${error.message}`); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
