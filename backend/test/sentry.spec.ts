import { describe, expect, it, vi } from 'vitest';
import { sentryOptions, scrubSentryEvent } from '../src/common/sentry-privacy.js';
import { captureUnexpectedError } from '../src/common/sentry.js';
import * as Sentry from '@sentry/nestjs';

describe('Sentry privacy boundary', () => {
  it('is disabled without a DSN and never captures without one', () => {
    expect(sentryOptions(undefined)).toBeUndefined();
    const capture = vi.fn();
    captureUnexpectedError(new Error('private'), 'request-1', capture, undefined);
    expect(capture).not.toHaveBeenCalled();
  });
  it('drops arbitrary private values while retaining validated correlation metadata', () => {
    const privateValue = 'private-health-token-email@example.invalid';
    const event = scrubSentryEvent({ message: privateValue, user: { email: privateValue }, request: { headers: { authorization: privateValue, cookie: privateValue }, data: { healthNotes: privateValue } }, extra: { password: privateValue }, contexts: { health: { notes: privateValue } }, breadcrumbs: [{ message: privateValue }], tags: { request_id: 'request-1', email: privateValue }, exception: { values: [{ type: 'TypeError', value: privateValue, stacktrace: { frames: [{ filename: '/private/person/app.js?token=secret', lineno: 12, vars: { health: privateValue } }] } }] } });
    expect(JSON.stringify(event)).not.toContain(privateValue);
    expect(event.tags).toEqual({ request_id: 'request-1' });
    expect(event.exception?.values?.[0].value).toBe('Unexpected application error');
    expect(scrubSentryEvent({ tags: { request_id: privateValue } }).tags).toEqual({});
  });
  it('attaches request ID to unexpected captures', () => {
    const capture = vi.fn();
    captureUnexpectedError(new Error('private'), 'request-2', capture, 'https://public@example.invalid/1');
    expect(capture).toHaveBeenCalledWith(expect.any(Error), { tags: { request_id: 'request-2' } });
  });
  it('scrubs the actual SDK transport envelope before sending', async () => {
    const send = vi.fn(async () => ({ statusCode: 200 }));
    Sentry.init({ ...sentryOptions('https://public@example.invalid/1'), defaultIntegrations: false, transport: () => ({ send, flush: async () => true }) });
    const privateValue = 'private-health-token-email@example.invalid';
    Sentry.captureException(new Error(privateValue), { tags: { request_id: 'request-3' }, extra: { healthNotes: privateValue }, user: { email: privateValue }, attachments: [{ filename: 'private.txt', data: privateValue }] });
    await Sentry.flush(1000);
    const envelope = JSON.stringify(send.mock.calls);
    expect(send).toHaveBeenCalled();
    expect(envelope).toContain('request-3');
    expect(envelope).not.toContain(privateValue);
    expect(envelope).not.toContain('private.txt');
    await Sentry.close(1000);
  });
});
