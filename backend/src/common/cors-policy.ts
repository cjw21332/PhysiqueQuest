function toOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}

export function isAllowedFrontendOrigin(
  origin: string | undefined,
  configuredOrigins: string[],
  nodeEnv: string | undefined,
): boolean {
  if (!origin) return true;
  const requestOrigin = toOrigin(origin);
  if (!requestOrigin) return false;

  const configured = configuredOrigins.some(value => toOrigin(value) === requestOrigin);
  if (configured) return true;
  if (nodeEnv === 'production') return false;

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && url.port === '3000' && isPrivateIpv4(url.hostname);
  } catch {
    return false;
  }
}
