import { describe, expect, it, vi } from 'vitest';
import { CHAT_QUESTION_CASES } from './chat-question-corpus.js';
import { createChatFixture, CHAT_FIXTURE_OWNER, CHAT_FIXTURE_PRIVATE } from './testing/chat-fixture.js';

describe('human phrased system questions', () => {
  const variants = [
    ['original', (value: string) => value],
    ['uppercase', (value: string) => value.toUpperCase()],
    ['lowercase', (value: string) => value.toLowerCase()],
    ['polite prefix', (value: string) => 'Hi Phiq, please help: ' + value],
    ['extra whitespace', (value: string) => '  ' + value.replace(/ /g, '   ') + '  '],
    ['curly apostrophe', (value: string) => value.replace(/'/g, '’')],
  ] as const;
  const phrasedCases = CHAT_QUESTION_CASES.flatMap(item => variants.map(([variant, transform]) => ({ ...item, variant, question: transform(item.question) })));
  it.each(phrasedCases)('$id [$variant]: $question', async item => {
    const generate = vi.fn().mockRejectedValue(new Error('A routine exact-record or reviewed-page question should not need model generation'));
    const fixture = createChatFixture({ generate } as never, item.scenario);
    const messages = item.conversation ? [...item.conversation.slice(0, -1), { role: 'user' as const, text: item.question }] : [{ role: 'user' as const, text: item.question }];
    const result = await fixture.service.reply(CHAT_FIXTURE_OWNER, messages, item.personal, item.page);
    expect(result.reply).not.toContain(CHAT_FIXTURE_PRIVATE);
    expect(result.reply).not.toMatch(/(?:^|\n)\s*(?:sources?|references?):/i);
    for (const term of item.requiredTerms ?? []) expect(result.reply, term).toMatch(new RegExp(term, 'i'));
    for (const term of item.forbiddenTerms ?? []) expect(result.reply, term).not.toMatch(new RegExp(term, 'i'));
    if (item.outcome !== 'boundary') expect(result.reply).not.toContain('Please ask about something in PhysiqueQuest');
    if (item.outcome === 'data') {
      expect(result.privacy.personalDataIncluded).toBe(true);
      expect(result.reply).not.toMatch(/^Enable|^Do you mean/);
      expect(result.sources.some(source => source.id.startsWith('user-'))).toBe(true);
      if (item.sourceIds) expect(result.sources.some(source => item.sourceIds!.includes(source.id))).toBe(true);
    } else if (item.outcome === 'guide' || item.outcome === 'consent' || item.outcome === 'boundary' || item.outcome === 'clarify') {
      expect(result.privacy.personalDataIncluded).toBe(false);
      expect(fixture.calls).toHaveLength(0);
    }
    for (const call of fixture.calls) expect(call.owner).toBe(CHAT_FIXTURE_OWNER);
    expect(generate).not.toHaveBeenCalled();
  });
  it.each(CHAT_QUESTION_CASES.filter(item => item.outcome === 'data'))('$id never reads records with consent off', async item => {
      const generate = vi.fn().mockRejectedValue(new Error(item.id + ': wording changed routine question into generation'));
      const fixture = createChatFixture({ generate } as never, item.scenario);
      const question = item.question;
      const messages = item.conversation ? [...item.conversation.slice(0, -1), { role: 'user' as const, text: question }] : [{ role: 'user' as const, text: question }];
      const result = await fixture.service.reply(CHAT_FIXTURE_OWNER, messages, false, item.page);
      expect(result.reply).toMatch(/Enable.*saved fitness data/i);
      expect(result.privacy.personalDataIncluded).toBe(false);
      expect(fixture.calls, item.id).toHaveLength(0);
      expect(generate, item.id).not.toHaveBeenCalled();
  });
});
