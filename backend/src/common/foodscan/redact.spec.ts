import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildLoggerOptions, createLogger } from './pino-logger.js';
import { isSecretKey, redact, safeString, safeUrl } from './redact.js';

/** Collects log output in memory so assertions can inspect real emitted JSON. */
function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const logger = createLogger(stream, 'info');
  return { logger, lines, text: () => lines.join('') };
}

describe('secret redaction', () => {
  describe('redact()', () => {
    it('replaces the image payload', () => {
      const out = redact({ image: 'iVBORw0KGgoAAAANSUhEUg', food: 'apple' }) as Record<string, unknown>;
      expect(out.image).toBe('[redacted]');
      expect(out.food).toBe('apple');
    });

    it('replaces credential-shaped keys at any depth', () => {
      const out = redact({
        level1: { level2: { api_key: 'USDA-KEY', authorization: 'Bearer x' } },
      }) as Record<string, Record<string, Record<string, string>>>;
      expect(out.level1.level2.api_key).toBe('[redacted]');
      expect(out.level1.level2.authorization).toBe('[redacted]');
    });

    it('recognises a bearer token regardless of case', () => {
      // This backend authenticates with a JWT in Authorization, so this key is
      // the one that actually matters here.
      expect(isSecretKey('Authorization')).toBe(true);
      expect(isSecretKey('authorization')).toBe(true);
      expect(isSecretKey('food_name')).toBe(false);
    });

    it('truncates long caller-supplied strings', () => {
      const long = 'a'.repeat(5000);
      const out = redact({ note: long }) as Record<string, string>;
      expect(out.note.length).toBeLessThan(400);
      expect(out.note).toContain('truncated');
    });

    it('strips control characters that could forge a log line', () => {
      const out = safeString('evil\n2026-01-01 info forged_entry\n');
      expect(out).not.toContain('\n');
    });

    it('bounds array length', () => {
      const out = redact({ items: Array.from({ length: 500 }, (_, i) => i) }) as { items: unknown[] };
      expect(out.items.length).toBe(21);
      expect(out.items[20]).toBe('[+480 more]');
    });

    it('breaks cycles instead of overflowing the stack', () => {
      const cyclic: Record<string, unknown> = { name: 'root' };
      cyclic.self = cyclic;
      expect(() => redact(cyclic)).not.toThrow();
      expect((redact(cyclic) as Record<string, unknown>).self).toBe('[circular]');
    });

    it('reduces an Error to name and message', () => {
      const out = redact(new Error('boom')) as Record<string, string>;
      expect(out).toEqual({ name: 'Error', message: 'boom' });
    });
  });

  describe('safeUrl()', () => {
    it('strips the USDA api_key query parameter', () => {
      const url = safeUrl('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=SECRET&query=apple');
      expect(url).not.toContain('SECRET');
      expect(url).not.toContain('api_key');
      expect(url).toBe('https://api.nal.usda.gov/fdc/v1/foods/search');
    });

    it('strips userinfo credentials', () => {
      const url = safeUrl('https://user:pass@internal.example.com/v1/foods?api_key=SECRET');
      expect(url).not.toContain('pass');
      expect(url).not.toContain('SECRET');
    });

    it('degrades unparseable input safely', () => {
      expect(safeUrl('not a url')).toBe('[unparseable url]');
    });
  });

  describe('logger configuration', () => {
    it('redacts session credentials, passwords, emails and parser bodies', () => {
      const { logger, text } = captureLogger();
      const keys = ['access_token', 'refresh_token', 'resetToken', 'password', 'passwordHash', 'email', 'body', 'conditions', 'healthNotes', 'contactName', 'contactPhone', 'contactRelationship'];
      const payload = Object.fromEntries(keys.map((key, i) => [key, `private-value-${i}`]));
      logger.info({ ...payload, nested: payload, req: { body: payload } }, 'redaction check');
      for (let i = 0; i < keys.length; i++) expect(text()).not.toContain(`private-value-${i}`);
    });
    it('redacts the bearer token from serialized headers', () => {
      const { logger, text } = captureLogger();
      logger.info(
        {
          req: {
            headers: {
              authorization: 'Bearer JWT-VALUE',
              cookie: 'session=SECRET',
              'content-type': 'application/json',
            },
          },
        },
        'test'
      );

      const out = text();
      expect(out).not.toContain('JWT-VALUE');
      expect(out).not.toContain('SECRET');
      expect(out).toContain('application/json');
    });

    it('redacts a top-level token field', () => {
      const { logger, text } = captureLogger();
      logger.info({ token: 'LEAKME', apiKey: 'LEAKME2' }, 'test');
      expect(text()).not.toContain('LEAKME');
      expect(text()).not.toContain('LEAKME2');
    });

    it('emits a single JSON object per line', () => {
      const { logger, lines } = captureLogger();
      logger.info({ event: 'x' }, 'hello');
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.event).toBe('x');
      expect(parsed.msg).toBe('hello');
      expect(parsed.service).toBe('physiquequest-backend');
      expect(parsed.level).toBeDefined();
    });

    it('never writes to a file', () => {
      // A file transport would be the natural place for a secret to persist.
      const options = buildLoggerOptions('info');
      expect(JSON.stringify(options)).not.toContain('destination');
    });
  });
});
