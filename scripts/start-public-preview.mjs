import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, writeFileSync, openSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCloudflareTunnelOrigin } from './cloudflareTunnelLog.mjs';

// Start isolated preview processes without interrupting the developer's servers.
const root = resolve(import.meta.dirname, '..');
const logDir = resolve(root, '.tools');
mkdirSync(logDir, { recursive: true });

async function ensurePortAvailable(port) {
  await new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once('error', error => {
      if (error.code === 'EADDRINUSE') {
        rejectPromise(new Error(`Preview port ${port} is already in use. Stop its existing PhysiqueQuest service before retrying.`));
      } else {
        rejectPromise(error);
      }
    });
    server.listen(port, '127.0.0.1', () => {
      server.close(error => error ? rejectPromise(error) : resolvePromise());
    });
  });
}

const tunnelLogPath = resolve(logDir, 'tunnel.log');
let origin;
const tunnelWaitDeadline = Date.now() + 15_000;
while (!origin && Date.now() < tunnelWaitDeadline) {
  if (existsSync(tunnelLogPath)) origin = readCloudflareTunnelOrigin(readFileSync(tunnelLogPath));
  if (!origin) await new Promise(resolve => setTimeout(resolve, 500));
}
if (!origin) {
  throw new Error('No active tunnel address was found. Start cloudflared on port 3100, wait for its HTTPS URL, then try again.');
}
const common = { ...process.env, NODE_ENV: 'development', CORS_ALLOWED_ORIGINS: origin,
  FRONTEND_URL: origin, API_PUBLIC_URL: origin, EMAIL_VERIFICATION_URL: origin,
  COOKIE_SECURE: 'true', COOKIE_SAMESITE: 'lax', TRUST_PROXY: '2', SWAGGER_ENABLED: 'false' };
let previous;
try { previous = JSON.parse(readFileSync(resolve(logDir, 'preview-processes.json'), 'utf8')); } catch {}
const webOnly = process.argv.includes('--web-only');
const processes = webOnly ? (previous?.processes ?? []).filter(p => p.name !== 'preview-web') : [];
if (!webOnly && previous?.processes?.some(p => { try { process.kill(p.pid, 0); return true; } catch { return false; } })) {
  throw new Error('Preview processes are already running; stop them before starting another preview.');
}
for (const port of (webOnly ? [3100] : [3100, 4100, 4150])) await ensurePortAvailable(port);

function launch(name, cwd, args, extra) {
  const log = openSync(resolve(logDir, `${name}.log`), 'a');
  const child = spawn(process.execPath, args, { cwd: resolve(root, cwd), env: { ...common, ...extra },
    detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  child.unref();
  processes.push({ name, pid: child.pid });
}
if (!webOnly) {
  launch('preview-backend', 'backend', ['dist/main.js'], { PORT: '4100' });
  launch('preview-coach', 'backend', ['dist/coach-main.js'], { COACH_PORT: '4150', COACH_FRONTEND_URL: origin });
}
launch('preview-web', 'frontend', ['../node_modules/next/dist/bin/next', 'start', '-p', '3100', '-H', '127.0.0.1'],
  { NODE_ENV: 'production', BACKEND_URL: 'http://127.0.0.1:4100', COACH_BACKEND_URL: 'http://127.0.0.1:4150' });
writeFileSync(resolve(logDir, 'preview-processes.json'), JSON.stringify({ origin, processes }, null, 2));
console.log(`Preview address: ${origin}`);
console.log('This temporary preview requires the PC and tunnel to stay running.');
