import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailDeliveryProvider } from '../src/providers/email-delivery.provider.js';

const emailJsSettings = {
  SERVICE_ID: 'service-id',
  TEMPLATE_ID: 'template-id',
  PUBLIC_KEY: 'public-key',
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
  it('uses the same EmailJS delivery and parameters for registration codes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const provider = createProvider(emailJsSettings);
    expect(await provider.sendVerificationCode('member@example.com', '123456')).toBe(true);
    const registration = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    await provider.sendPasswordReset('member@example.com', '123456');
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual(registration);
  });

  it('uses the existing legacy mailer for registration codes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetch);
    const provider = createProvider({ EMAIL_DELIVERY_URL: 'https://delivery.example.test/send', EMAIL_DELIVERY_API_KEY: 'legacy-key' });
    expect(await provider.sendVerificationCode('member@example.com', '123456')).toBe(true);
  });
  it('sends the reset code through EmailJS with the configured template parameters', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const provider = createProvider(emailJsSettings);

    expect(provider.isAvailable()).toBe(true);
    await expect(provider.sendPasswordReset('member@example.com', '123456', '  Toji Fushiguro  ')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('https://api.emailjs.com/api/v1.0/email/send', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service-id',
        template_id: 'template-id',
        user_id: 'public-key',
        accessToken: 'private-key',
        template_params: {
          email: 'member@example.com',
          passcode: '123456',
          time: '10 minutes',
          name: 'Toji',
        },
      }),
    }));
  });

  it.each([
    ['Mary-Jane Watson', 'Mary-Jane'],
    ['Toji', 'Toji'],
    ['Ana\tMaria Santos', 'Ana'],
    ['   ', 'there'],
  ])('uses a first-name greeting for %j', async (name, expected) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await createProvider(emailJsSettings).sendPasswordReset('member@example.com', '123456', name);
    const payload = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(payload.template_params.name).toBe(expected);
  });

  it('does not require a private key when the EmailJS public key is configured', () => {
    const provider = createProvider({
      SERVICE_ID: 'service-id',
      TEMPLATE_ID: 'template-id',
      PUBLIC_KEY: 'public-key',
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
    await expect(provider.sendPasswordReset('member@example.com', '123456')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('https://delivery.example.test/send', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        template: 'password-reset',
        to: 'member@example.com',
        token: '123456',
        expiresInMinutes: 10,
      }),
    }));
  });

  it('reports a rejected EmailJS delivery with a classified reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('invalid service', { status: 400 })));
    const provider = createProvider(emailJsSettings);

    await expect(provider.sendPasswordReset('member@example.com', '123456')).resolves.toEqual({
      ok: false,
      code: 'EMAIL_PROVIDER_REJECTED',
      status: 400,
      reason: 'invalid service',
    });
  });

  it('classifies an authentication rejection from EmailJS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    const provider = createProvider(emailJsSettings);

    await expect(provider.sendPasswordReset('member@example.com', '123456')).resolves.toMatchObject({
      ok: false,
      code: 'EMAIL_PROVIDER_AUTH',
      status: 403,
    });
  });

  it('reports when no provider is configured', async () => {
    const provider = createProvider({});

    await expect(provider.sendPasswordReset('member@example.com', '123456')).resolves.toMatchObject({
      ok: false,
      code: 'EMAIL_NOT_CONFIGURED',
    });
  });
});
