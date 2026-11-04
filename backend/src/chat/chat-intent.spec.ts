import { describe, expect, it } from 'vitest';
import { classifyChatQuestion, normalizeChatQuestion, resolveChatFollowUp } from './chat-intent.js';
describe('shared question interpretation', () => {
  it.each(["what's my current diet plan?", 'what’s my current diet plan?', 'WHAT IS MY CURRENT EATING PLAN?', 'What is my active nutrition plan?'])('recognizes own diet phrasing: %s', question => {
    expect(classifyChatQuestion(question)).toMatchObject({ personal: true, guide: false, topics: ['nutrition'] });
  });
  it.each(['Tell me about my current Coach program', 'Explain my settings', 'Where am I in my weight goal?', 'What have I eaten today?', 'Which badges have I earned?'])('does not confuse record reading with page help: %s', question => {
    expect(classifyChatQuestion(question)).toMatchObject({ personal: true, guide: false });
  });
  it.each(['How do I change my goal?', 'How can I view my report?', 'Where can I change my diet plan?'])('keeps procedures independent of account data: %s', question => {
    expect(classifyChatQuestion(question)).toMatchObject({ personal: false, guide: true });
  });
  it('normalizes spacing before applying semantic aliases', () => {
    expect(normalizeChatQuestion('  What   am   I   working   toward? ')).toContain('my fitness goal');
  });
  it('carries user context for a pronoun follow-up but does not overwrite explicit new topics', () => {
    expect(resolveChatFollowUp('How much protein is that in grams?', ['What is my saved diet plan?'])).toContain('saved diet plan');
    expect(resolveChatFollowUp('What is my target weight?', ['What is my saved diet plan?'])).toBe('What is my target weight?');
  });
});
