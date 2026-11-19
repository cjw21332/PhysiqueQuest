import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next');
const coachUrl = process.env.NEXT_PUBLIC_COACH_API_URL || 'https://physiquequest-coach.onrender.com/api';
const coachOrigin = new URL(coachUrl);
if (coachOrigin.protocol !== 'https:' || coachOrigin.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(coachOrigin.hostname) || coachOrigin.hostname.endsWith('.trycloudflare.com')) {
  throw new Error('A standalone build requires a public HTTPS Coach service URL.');
}
const child = spawn(process.execPath, [next, 'build'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PQ_MOBILE_EXPORT: '1', NEXT_PUBLIC_API_URL: '', NEXT_PUBLIC_COACH_API_URL: coachUrl },
  stdio: 'inherit',
});
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
