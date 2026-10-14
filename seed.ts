// Compatibility entrypoint. Prefer `npm run seed` from the repository root.
// The backend importer uses its own environment and preserves existing records.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'seed:exercises'], {
  cwd: fileURLToPath(new URL('./backend', import.meta.url)), stdio: 'inherit', shell: process.platform === 'win32',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
