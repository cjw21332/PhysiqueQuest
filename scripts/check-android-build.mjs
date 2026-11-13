import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const id = process.argv[2];
if (!/^[a-f0-9-]{36}$/.test(id ?? '')) throw new Error('Supply an EAS build UUID.');
const raw = execFileSync('cmd.exe', ['/d', '/s', '/c', `npx --no-install eas-cli build:view ${id} --json`],
  { cwd: resolve(root, 'mobile'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const build = JSON.parse(raw);
mkdirSync(resolve(root, '.tools'), { recursive: true });
writeFileSync(resolve(root, '.tools/build-status.json'), JSON.stringify(build));
console.log(`Android build: ${build.status}`);
for (const url of build.logFiles ?? []) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Log retrieval failed: ${response.status}`);
  const lines = (await response.text()).trim().split('\n');
  console.log(lines.slice(-8).map(line => { try { return JSON.parse(line).msg; } catch { return line; } }).join('\n'));
}
if (build.status === 'FINISHED' && build.artifacts?.buildUrl) {
  const response = await fetch(build.artifacts.buildUrl);
  if (!response.ok) throw new Error(`APK download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('Downloaded artifact is not an APK/ZIP.');
  const directory = resolve(root, 'artifacts/android');
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, 'PhysiqueQuest-preview.apk');
  writeFileSync(file, bytes);
  console.log(`APK saved: ${file} (${bytes.length} bytes)`);
  console.log(build.artifacts.buildUrl);
}
