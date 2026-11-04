import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHAT_PAGES, resolveChatPage, selectChatPages } from './chat-pages.js';
import { fastPageAnswer } from './chat-fast-answers.js';

describe('reviewed page knowledge coverage', () => {
  it('covers every static frontend page and each allowed section subpage', () => {
    const root = resolve('../frontend/app'), paths: string[] = [];
    const visit = (directory: string, segments: string[]) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('[')) visit(resolve(directory, entry.name), entry.name.startsWith('(') ? segments : [...segments, entry.name]);
        } else if (entry.name === 'page.tsx') paths.push('/' + segments.join('/'));
      }
    };
    visit(root, []);
    for (const section of ['home', 'coach', 'scan', 'me']) {
      const content = readFileSync(resolve(root, '(app)', section, '[view]', 'page.tsx'), 'utf8');
      const array = /!\[([^\]]+)\]\.includes/.exec(content);
      if (array) for (const match of array[1].matchAll(/'([^']+)'/g)) paths.push('/' + section + '/' + match[1]);
      else for (const match of content.matchAll(/\.view !== '([^']+)'/g)) paths.push('/' + section + '/' + match[1]);
    }
    for (const path of paths) expect(resolveChatPage(path), 'Missing ' + path).toBeDefined();
    expect(new Set(CHAT_PAGES.map(page => page.path)).size).toBe(CHAT_PAGES.length);
  });
  it('has direct contextual help for every known page, with no personal data', () => {
    for (const page of CHAT_PAGES) {
      const answer = fastPageAnswer('What can I do on this page?', page.path);
      expect(answer?.reply).toContain(page.title);
      expect(answer?.reply).toContain(page.path);
      expect(answer?.reply).not.toMatch(/Sources:/i);
    }
  });
  it('rejects external/arbitrary paths and never treats incidental substrings as a topic', () => {
    for (const value of ['https://evil.example/me', '//evil.example/me', '/me/../../api/admin', '/unknown', '/me\\secret']) expect(resolveChatPage(value)).toBeUndefined();
    expect(selectChatPages('What is the capital of France?', '/scan')).toEqual([]);
    expect(selectChatPages('How do I calculate compound interest?')).toEqual([]);
    expect(resolveChatPage('/scan/history?date=2026-10-29')?.path).toBe('/scan/history');
  });
  it.each([
    ['How do I change my training equipment?', '/me/training'],
    ['Where is my dietary plan meal schedule?', '/scan/plan'],
    ['How do I set daily reminders?', '/home/notifications'],
    ['How do I pause and resume an active workout?', '/coach/session'],
    ['How do I edit a saved meal?', '/scan/edit-meal'],
  ])('retrieves the right page: %s', (question, expected) => {
    expect(selectChatPages(question)[0]?.path).toBe(expected);
  });
});
