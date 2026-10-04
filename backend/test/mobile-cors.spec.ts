import { describe, expect, it } from 'vitest';
import { isAllowedFrontendOrigin } from '../src/common/cors-policy.js';

describe('Expo Go frontend CORS policy', () => {
  const configured = ['https://app.physiquequest.example/'];

  it('accepts requests without an Origin header and explicit configured origins', () => {
    expect(isAllowedFrontendOrigin(undefined, configured, 'production')).toBe(true);
    expect(isAllowedFrontendOrigin('https://app.physiquequest.example', configured, 'production')).toBe(true);
  });

  it('accepts only RFC1918 HTTP origins on frontend port 3000 in development', () => {
    for (const origin of [
      'http://10.0.0.5:3000',
      'http://192.168.1.42:3000',
      'http://172.16.0.10:3000',
      'http://172.31.255.255:3000',
    ]) {
      expect(isAllowedFrontendOrigin(origin, configured, 'development')).toBe(true);
    }
    for (const origin of [
      'https://192.168.1.42:3000',
      'http://192.168.1.42:3001',
      'http://172.32.0.1:3000',
      'http://8.8.8.8:3000',
      'http://192.168.999.1:3000',
    ]) {
      expect(isAllowedFrontendOrigin(origin, configured, 'development')).toBe(false);
    }
  });

  it('rejects unconfigured LAN, public, malformed, and wrong-port origins in production', () => {
    for (const origin of [
      'http://192.168.1.42:3000',
      'http://localhost:3000',
      'https://8.8.8.8:3000',
      'not an origin',
    ]) {
      expect(isAllowedFrontendOrigin(origin, configured, 'production')).toBe(false);
    }
  });
});
