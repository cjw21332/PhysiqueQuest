import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function createReplayServer(root, videoRoot) {
  const inside = (base, name) => {
    const result = path.resolve(base, name);
    const relative = path.relative(base, result);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Path outside replay root');
    return result;
  };
  return http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/') {
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><title>Local pose replay</title><script type="module" src="/scripts/pose-replay/browser.mjs"></script>');
        return;
      }
      if (!['/videos/','/pose/','/shared/','/frontend/workers/','/frontend/lib/','/backend/src/pose-tracker/','/scripts/pose-replay/'].some(prefix => pathname.startsWith(prefix)) && pathname !== '/mediapipe.mjs') throw Error('Route outside replay inputs');
      const file = pathname.startsWith('/videos/') ? inside(videoRoot, pathname.slice(8))
        : pathname.startsWith('/pose/') ? inside(path.join(root, 'frontend/public'), pathname.slice(1))
        : pathname === '/mediapipe.mjs' ? path.join(root, 'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')
        : inside(root, pathname.slice(1));
      if (!fs.statSync(file).isFile()) throw Error('Not a file');
      if (file.endsWith('.ts')) {
        let source = fs.readFileSync(file, 'utf8');
        // Read-only instrumentation: expose existing counter state in snapshot().
        // It changes neither update() nor transitions nor the on-disk source.
        if (file === path.join(root, 'shared/exerciseEngine.ts')) {
          const marker = 'snapshot() { return counter.summary(); },';
          if (source.split(marker).length !== 2) throw Error('Counter diagnostic instrumentation anchor changed');
          source = source.replace(marker, 'snapshot() { return { ...counter.summary(), replayDiagnostics: { bilateralSide: counter.bilateralSide, sides: counter.sides } }; },');
        }
        source = source.replace(/from\s*(['"])([^'"]+)\1/g, (match, quote, name) => {
          if (name === '@mediapipe/tasks-vision') return 'from "/mediapipe.mjs"';
          if (name.startsWith('.') && !path.extname(name) && fs.existsSync(path.resolve(path.dirname(file), `${name}.ts`))) return `from ${quote}${name}.ts${quote}`;
          return match;
        });
        response.setHeader('Content-Type', 'text/javascript');
        response.end(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
        return;
      }
      const size = fs.statSync(file).size;
      response.setHeader('Content-Type', file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.wasm') ? 'application/wasm' : /\.(mjs|js)$/.test(file) ? 'text/javascript' : 'application/octet-stream');
      response.setHeader('Accept-Ranges', 'bytes');
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      let start = 0, end = size - 1;
      if (range) {
        start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), end) : end;
        if (start > end || start >= size) { response.writeHead(416); response.end(); return; }
        response.statusCode = 206;
        response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      }
      response.setHeader('Content-Length', end - start + 1);
      const stream = fs.createReadStream(file, { start, end });
      response.on('close', () => stream.destroy());
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) { response.writeHead(404); response.end(String(error.message)); }
  });
}
