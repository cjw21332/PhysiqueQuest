// One command runs two isolated landmark/fake-bitmap simulations.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const minutes = Number(process.argv[2] || 30);
if (!Number.isInteger(minutes) || minutes < 6) throw Error('Use at least 6 simulated minutes');
let failed = false;
for (const force of [true, false]) {
  const args = [...(force ? ['--expose-gc'] : []), 'scripts/pose-replay/landmark-soak.cjs', String(minutes), '--fake-bitmap'];
  const run = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (run.status !== 0) { process.stderr.write(run.stderr); process.exit(1); }
  const file = `output/pose-replay-private/landmark-soak-telemetry-off-fake-bitmap-${force ? 'forced-gc' : 'normal-gc'}.json`;
  const result = JSON.parse(fs.readFileSync(file));
  const rows = result.windows.slice(4), meanX = rows.reduce((n,r)=>n+r.minute,0)/rows.length;
  const meanY = rows.reduce((n,r)=>n+r.heapUsed,0)/rows.length;
  const slope = rows.reduce((n,r)=>n+(r.minute-meanX)*(r.heapUsed-meanY),0)/rows.reduce((n,r)=>n+(r.minute-meanX)**2,0)/1048576;
  const growth = (rows.at(-1).heapUsed - rows[0].heapUsed)/1048576;
  const pass = growth <= 20 && slope <= .5 && result.bitmapsCreated === result.bitmapsClosed;
  failed ||= !pass;
  console.log(JSON.stringify({ mode: force ? 'forced-gc' : 'normal-gc', growthMiB:growth, slopeMiBPerMinute:slope, bitmapsCreated:result.bitmapsCreated, bitmapsClosed:result.bitmapsClosed, pass, file }));
}
if (failed) process.exitCode = 1;
