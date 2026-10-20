import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./App.tsx',import.meta.url),'utf8');
test('WebView follows system font scale and reinjects updates without remounting',()=>{
  assert.match(source,/textZoom=\{Math.round\(fontScale \* 100\)\}/);
  assert.match(source,/Platform.OS === 'ios' \? Math.round\(fontScale \* 100\) : 100/);
  assert.match(source,/useEffect\(\(\) => \{ pushInsets\(\); \}, \[pushInsets\]\)/);
  assert.doesNotMatch(source,/textZoom=\{100\}/);
});
test('connection fallback scrolls and names its input; native camera has a 48dp target',()=>{
  assert.match(source,/<ScrollView[\s\S]*contentContainerStyle=\{styles.errorScroll\}/);
  assert.match(source,/accessibilityLabel="Computer address"/);
  assert.match(source,/nativeCameraFacing: \{[\s\S]*?minHeight: 48,[\s\S]*?minWidth: 48/);
});
