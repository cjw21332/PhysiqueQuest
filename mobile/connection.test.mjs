import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeFrontendUrl,
  resolveApiUrl,
  resolveFrontendUrl,
} from './connection.mjs';

test('normalizes a manually entered IPv4 address without a scheme', () => {
  assert.equal(normalizeFrontendUrl(' 192.168.1.42:3000/ '), 'http://192.168.1.42:3000');
});

test('keeps a configured HTTPS frontend and removes trailing slashes', () => {
  assert.equal(normalizeFrontendUrl('https://fitness.example.com///'), 'https://fitness.example.com');
  assert.equal(resolveFrontendUrl('https://fitness.example.com/', '192.168.1.42:8081'), 'https://fitness.example.com');
});

test('infers the frontend from an RFC1918 Expo LAN host URI', () => {
  assert.equal(resolveFrontendUrl(undefined, '192.168.1.42:8081'), 'http://192.168.1.42:3000');
  assert.equal(resolveFrontendUrl(undefined, '10.0.0.8:8081'), 'http://10.0.0.8:3000');
  assert.equal(resolveFrontendUrl(undefined, '172.20.1.4:8081'), 'http://172.20.1.4:3000');
});

test('does not mistake public addresses or Expo tunnel hosts for the LAN app host', () => {
  assert.equal(resolveFrontendUrl(undefined, '203.0.113.8:8081'), null);
  assert.equal(resolveFrontendUrl(undefined, 'u.expo.dev:8081'), null);
  assert.equal(resolveFrontendUrl(undefined, 'exp://abc123.exp.direct'), null);
});

test('rejects malformed and non-HTTP(S) frontend URLs', () => {
  assert.equal(normalizeFrontendUrl('not a url'), null);
  assert.equal(normalizeFrontendUrl('ftp://192.168.1.4:3000'), null);
  assert.equal(normalizeFrontendUrl(''), null);
});

test('uses an explicit API URL and ensures the API prefix appears once', () => {
  assert.equal(resolveApiUrl('https://api.example.com/api/', 'https://fitness.example.com'), 'https://api.example.com/api');
  assert.equal(resolveApiUrl('http://192.168.1.42:4000', 'http://192.168.1.42:3000'), 'http://192.168.1.42:4000/api');
});

test('derives the API origin from the frontend host while preserving HTTP or HTTPS', () => {
  assert.equal(resolveApiUrl(undefined, 'http://192.168.1.42:3000'), 'http://192.168.1.42:4000/api');
  assert.equal(resolveApiUrl(undefined, 'https://fitness.example.com'), 'https://fitness.example.com:4000/api');
});

test('rejects malformed API URLs', () => {
  assert.equal(resolveApiUrl('not a url', 'http://192.168.1.42:3000'), null);
  assert.equal(resolveApiUrl(undefined, 'file:///tmp/app'), null);
});
