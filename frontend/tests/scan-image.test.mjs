import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
test('scan images are downscaled before upload and release their bitmap', async () => {
  const source = await readFile(new URL('../lib/scanImage.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { toScanImage } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const prior = { document: globalThis.document, createImageBitmap: globalThis.createImageBitmap };
  let closed = false, quality;
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: (type, value) => { assert.equal(type, 'image/jpeg'); quality = value; return 'data:image/jpeg;base64,c3ludGhldGlj'; } };
  globalThis.createImageBitmap = async () => ({ width: 2560, height: 1280, close() { closed = true; } });
  globalThis.document = { createElement: () => canvas };
  try {
    assert.deepEqual(await toScanImage({}), { base64: 'c3ludGhldGlj', mimeType: 'image/jpeg' });
    assert.equal(canvas.width, 1280); assert.equal(canvas.height, 640); assert.equal(quality, 0.82); assert.equal(closed, true);
  } finally { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
