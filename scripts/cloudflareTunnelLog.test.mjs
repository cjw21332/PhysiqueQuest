import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCloudflareTunnelOrigin } from './cloudflareTunnelLog.mjs';

test('reads the latest Quick Tunnel URL from a Windows PowerShell UTF-16 log', () => {
  const log = '\uFEFFINFO old https://old-tunnel.trycloudflare.com\r\nINFO https://tunnel-7-name.trycloudflare.com\r\n';
  assert.equal(readCloudflareTunnelOrigin(Buffer.from(log, 'utf16le')), 'https://tunnel-7-name.trycloudflare.com');
});

test('reads the Quick Tunnel URL from a UTF-8 log', () => {
  assert.equal(
    readCloudflareTunnelOrigin(Buffer.from('Your quick Tunnel is at https://new-tunnel.trycloudflare.com', 'utf8')),
    'https://new-tunnel.trycloudflare.com',
  );
});

test('returns null when the log contains no Quick Tunnel URL', () => {
  assert.equal(readCloudflareTunnelOrigin(Buffer.from('Cloudflared failed to start', 'utf8')), null);
});

test('does not treat a stopped tunnel URL in an old log as active', () => {
  const log = 'https://stopped-tunnel.trycloudflare.com\nTunnel server stopped';
  assert.equal(readCloudflareTunnelOrigin(Buffer.from(log, 'utf8')), null);
});
