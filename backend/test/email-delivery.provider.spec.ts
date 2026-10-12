import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailDeliveryProvider } from '../src/providers/email-delivery.provider.js';

const emailJsSettings = {
  EMAILJS_SERVICE_ID: 'service-id',
  EMAILJS_TEMPLATE_ID: 'template-id',
  EMAILJS_PUBLIC_KEY: 'public-key',
  EMAILJS_PRIVATE_KEY: 'private-key',
};

function createProvider(settings: Record<string, string>) {
  const config = { get: (key: string) => settings[key] } as unknown as ConfigService;
  return new EmailDeliveryProvider(config);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EmailDeliveryProvider', () => {
  it('sends the reset code through EmailJS with the configured template parameters', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const provider = createProvider(emailJsSettings);

    expect(provider.isAvailable()).toBe(true);
    await expect(provider.sendPasswordReset('member@example.com', '123456')).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://api.emailjs.com/api/v1.0/email/send', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service-id',
        template_id: 'template-id',
        user_id: 'public-key',
        accessToken: 'private-key',
        template_params: {
          to_email: 'member@example.com',
          otp: '123456',
          expires_in_minutes: 30,
        },
      }),
    }));
  });

  it('does not require a private key when the EmailJS public key is configured', () => {
    const provider = createProvider({
      EMAILJS_SERVICE_ID: 'service-id',
      EMAILJS_TEMPLATE_ID: 'template-id',
      EMAILJS_PUBLIC_KEY: 'public-key',
    });

    expect(provider.isAvailable()).toBe(true);
  });

  it('uses the legacy delivery endpoint when EmailJS is not configured', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetch);
    const provider = createProvider({
      EMAIL_DELIVERY_URL: 'https://delivery.example.test/send',
      EMAIL_DELIVERY_API_KEY: 'legacy-key',
    });

    expect(provider.isAvailable()).toBe(true);
    await expect(provider.sendPasswordReset('member@example.com', '123456')).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://delivery.example.test/send', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        template: 'password-reset',
        to: 'member@example.com',
        token: '123456',
        expiresInMinutes: 30,
      }),
    }));
  });

  it('reports a rejected EmailJS delivery', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 400 })));
    const provider = createProvider(emailJsSettings);

    await expect(provider.sendPasswordReset('member@example.com', '123456')).resolves.toBe(false);
  });
});
