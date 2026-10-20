const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const artifacts = path.resolve(__dirname, '..');
const before = path.join(artifacts, 'css-distill-before');
const after = path.join(artifacts, 'css-distill-after');
async function compare() {
  const results = [];
  for (const file of fs.readdirSync(before, { recursive: true }).filter(file => file.endsWith('.png'))) {
    const next = path.join(after, file);
    if (!fs.existsSync(next)) { results.push({ file, missing: true }); continue; }
    const a = await sharp(path.join(before, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(next).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (JSON.stringify(a.info) !== JSON.stringify(b.info)) { results.push({ file, dimensionsChanged: true }); continue; }
    let changed = 0;
    for (let i = 0; i < a.data.length; i += 4) if (a.data.subarray(i, i + 4).compare(b.data.subarray(i, i + 4))) changed++;
    results.push({ file, changedPixels: changed, percent: +(100 * changed / (a.info.width * a.info.height)).toFixed(4) });
  }
  fs.writeFileSync(path.join(__dirname, 'visual-comparison.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ total: results.length, identical: results.filter(row => row.changedPixels === 0).length, changed: results.filter(row => row.changedPixels !== 0) }, null, 2));
}
compare().catch(error => { console.error(error); process.exitCode = 1; });
