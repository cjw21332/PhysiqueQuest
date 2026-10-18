import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const config = require('./app.config.js');
function environment(values, action) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try { for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } action(); }
  finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}
test('release config requires explicitly configured public HTTPS endpoints', () => {
  environment({ PQ_RELEASE_MODE: 'true', EXPO_PUBLIC_WEB_APP_URL: undefined, EXPO_PUBLIC_API_URL: undefined }, () => assert.throws(config, /explicitly set/));
  for (const url of ['http://app.example.com', 'https://192.168.1.10', 'https://localhost', 'https://0.0.0.0', 'https://[::1]', 'https://169.254.2.3', 'https://dev.local', 'https://user:password@app.example.com', 'https://app.example.com?token=secret']) {
    environment({ PQ_RELEASE_MODE: 'true', EXPO_PUBLIC_WEB_APP_URL: url, EXPO_PUBLIC_API_URL: 'https://api.example.com/api' }, () => assert.throws(config, /public HTTPS/));
  }
  environment({ PQ_RELEASE_MODE: 'true', EXPO_PUBLIC_WEB_APP_URL: 'https://app.example.com', EXPO_PUBLIC_API_URL: 'https://api.example.com/api' }, () => assert.equal(config().extra.EXPO_PUBLIC_API_URL, 'https://api.example.com/api'));
});
