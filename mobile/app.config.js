const config = require('./app.json').expo;
function releaseUrl(name, fallback) {
  const value = process.env[name] || fallback;
  if (process.env.PQ_RELEASE_MODE === 'true') {
    if (!process.env[name]) throw new Error(`${name} must be explicitly set for a release build.`);
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const privateHost = !host.includes('.') || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || /^(0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || privateHost) throw new Error(`${name} must be a public HTTPS URL.`);
  }
  return value;
}
module.exports = () => ({ ...config, extra: { ...config.extra,
  EXPO_PUBLIC_WEB_APP_URL: releaseUrl('EXPO_PUBLIC_WEB_APP_URL', config.extra.EXPO_PUBLIC_WEB_APP_URL),
  EXPO_PUBLIC_API_URL: releaseUrl('EXPO_PUBLIC_API_URL', config.extra.EXPO_PUBLIC_API_URL),
} });
