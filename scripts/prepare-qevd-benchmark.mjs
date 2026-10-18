import { writeFile, mkdir } from 'node:fs/promises';
import { QEVD_SOURCE, QEVD_REVISION, prepareBenchmark, sha256 } from './qevd-research.mjs';
const directory = new URL('../research-data/qevd/', import.meta.url);
await mkdir(directory, { recursive: true });
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--video' || !/^\d+$/.test(args[1]))) throw new Error('Usage: node scripts/prepare-qevd-benchmark.mjs [--video 0006]');
async function fetchFile(name, maximumBytes) {
  const response = await fetch(`${QEVD_SOURCE}/resolve/${QEVD_REVISION}/${name}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Dataset fetch failed (${response.status})`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > maximumBytes) throw new Error('Research input exceeds size limit');
  return body;
}
// Pin fresh annotations; preserve hand-reviewed work in a separate file.
const body = await fetchFile('samples.json', 5_000_000);
const manifest = prepareBenchmark(JSON.parse(body), sha256(body));
await writeFile(new URL('samples.json', directory), body);
await writeFile(new URL('manifest.proposed.json', directory), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest.audit, null, 2));
if (args.length) {
  const video = manifest.videos.find(item => item.videoId === args[1]);
  if (!video) throw new Error('Video is not in the pinned benchmark');
  await mkdir(new URL('data/', directory), { recursive: true });
  const bytes = await fetchFile(video.filepath, 50_000_000);
  await writeFile(new URL(video.filepath, directory), bytes);
  console.log(`Saved research video ${video.videoId}; SHA-256 ${sha256(bytes)}`);
}
console.log('Research-only files saved under ignored research-data/qevd. Copy manifest.proposed.json to manifest.reviewed.json for manual review; reruns do not overwrite that file.');
