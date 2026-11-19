// Start the optional local provider when the development API is configured to use it.
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(backend, '..');
const readEnv = path => {
  try { return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).trim().replace(/^(['"])(.*)\1$/, '$2')]; })); }
  catch { return {}; }
};
const backendEnv = { ...readEnv(resolve(backend, '.env')), ...process.env };
const localUrl = 'http://127.0.0.1:8000/analyze';
if (backendEnv.POSE_ANALYSIS_URL === localUrl) {
  const service = resolve(root, 'pose-service');
  const python = resolve(service, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const serviceKey = readEnv(resolve(service, '.env')).POSE_ANALYSIS_API_KEY;
  if (existsSync(python) && serviceKey && serviceKey === backendEnv.POSE_ANALYSIS_API_KEY && serviceKey.length >= 32) {
    const alreadyRunning = await new Promise(resolveResult => {
      const socket = createConnection({ host: '127.0.0.1', port: 8000 });
      socket.setTimeout(1000);
      socket.on('connect', () => { socket.destroy(); resolveResult(true); });
      socket.on('error', () => resolveResult(false));
      socket.on('timeout', () => { socket.destroy(); resolveResult(false); });
    });
    if (!alreadyRunning) {
      const child = spawn(python, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000', '--no-access-log'], {
        cwd: service, env: { ...process.env, POSE_ANALYSIS_API_KEY: serviceKey }, detached: true, windowsHide: true, stdio: 'ignore',
      });
      child.on('error', () => {});
      child.unref();
      console.log('Starting local video analysis service.');
    }
  }
}
