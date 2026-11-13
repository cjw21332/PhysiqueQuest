export function readCloudflareTunnelOrigin(buffer) {
  const text = buffer[0] === 0xff && buffer[1] === 0xfe
    ? buffer.toString('utf16le', 2)
    : buffer.includes(0)
      ? buffer.toString('utf16le')
      : buffer.toString('utf8');
  const origins = [...text.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi)];
  const latest = origins.at(-1);
  if (!latest || text.indexOf('Tunnel server stopped', latest.index) !== -1) return null;
  return latest[0];
}
