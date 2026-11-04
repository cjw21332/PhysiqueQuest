import { describe, expect, it, vi } from 'vitest';
import { createChatFixture, CHAT_FIXTURE_OWNER } from './testing/chat-fixture.js';

function setup(scenario: 'populated' | 'empty' | 'partial' = 'populated') {
  const generate = vi.fn().mockRejectedValue(new Error('A supported exact-record request must not require generation'));
  const fixture = createChatFixture({ generate } as never, scenario);
  const ask = async (text: string, page?: string) => fixture.service.reply(CHAT_FIXTURE_OWNER, [{ role: 'user', text }], true, page);
  return { ...fixture, ask, generate };
}

describe('nutrition and compound record boundaries', () => {
  it.each(['/home', '/coach', '/scan', '/scan/plan', '/quests', '/me', undefined])('uses explicit diet intent independently of page %s', async page => {
    const { ask } = setup();
    const answer = await ask("what's my current diet plan?", page);
    expect(answer.reply).toContain('Maintenance');
    expect(answer.reply).toContain('2000 kcal');
    expect(answer.reply).toContain('30% (150 g/day)');
    expect(answer.sources.map(source => source.id)).toEqual(['user-nutrition']);
  });
  it('reports being over target without negative remaining calories', async () => {
    const { ask, data } = setup();
    data.nutrition[0].meals[0].calories = 1300;
    const answer = await ask('How many calories are left today?');
    expect(answer.reply).toContain('remaining');
    expect(answer.reply).toContain('0 kcal');
    expect(answer.reply).toContain('500 kcal above');
    expect(answer.reply).not.toContain('-500');
  });
  it('does not treat an invalid daily nutrient as zero or substitute calories from a target', async () => {
    const { ask, data } = setup();
    data.nutrition[0].meals[0].calories = null;
    const answer = await ask('How many calories are left today?');
    expect(answer.reply).toMatch(/remaining is unavailable/i);
    expect(answer.reply).not.toMatch(/500 kcal|remaining.*0 kcal/);
  });
  it('does not infer remaining grams from an incomplete plan', async () => {
    const { ask } = setup('partial');
    expect((await ask('How much protein is left today?')).reply).toMatch(/remaining is unavailable/i);
  });
  it('keeps an absent nutrition record distinct from zero logged intake', async () => {
    const { ask } = setup('empty');
    const answer = await ask('How many calories have I logged today?');
    expect(answer.reply).toContain('unavailable');
    expect(answer.reply).not.toContain('0 kcal');
  });
  it('uses all daily rows for totals even when only twelve meal details are available', async () => {
    const { ask, data } = setup();
    const meal = data.nutrition[0].meals[0];
    data.nutrition[0].meals = Array.from({ length: 30 }, () => ({ ...meal, calories: 50 }));
    expect((await ask('How many calories are left today?')).reply).toContain('500 kcal');
    const answer = await ask('What did I log for breakfast today?');
    expect(answer.reply).toContain('12 of 30');
    expect(answer.reply).toMatch(/outside this excerpt/i);
  });
  it('preserves both independent sources for a mixed-domain answer', async () => {
    const { ask } = setup();
    const answer = await ask('What are my current weight and daily calorie target?');
    expect(answer.reply).toContain('72 kg');
    expect(answer.reply).not.toContain('68 kg');
    expect(answer.reply).toContain('2000 kcal');
    expect(answer.sources.map(source => source.id)).toEqual(expect.arrayContaining(['user-profile', 'user-nutrition']));
  });
  it('does not replace distinct selected training days with a saved program schedule', async () => {
    const { ask, data } = setup();
    data.profiles[0].days = ['Tuesday'];
    const answer = await ask('Which training days did I select in my profile?');
    expect(answer.reply).toContain('Tuesday');
    expect(answer.reply).not.toContain('Monday');
    expect(answer.sources.map(source => source.id)).toEqual(['user-profile']);
  });
  it('distinguishes planned duration from completed duration when both are requested', async () => {
    const { ask } = setup();
    const answer = await ask('What is my planned training duration and how long was my last completed workout?');
    expect(answer.reply).toContain('45 min');
    expect(answer.reply).toContain('40 min');
  });
  it('filters requested food history to its range rather than returning a general recent excerpt', async () => {
    const { ask, data } = setup();
    data.nutrition[0].meals.push({ ...data.nutrition[0].meals[0], name: 'Outside requested period', date: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10) });
    const answer = await ask('Show my food history for the past 7 days.');
    expect(answer.reply).toContain('Oatmeal');
    expect(answer.reply).not.toContain('Outside requested period');
  });
  it('distinguishes a period total from the requested average over calendar days or meal entries', async () => {
    const { ask } = setup();
    expect((await ask('What is my average logged calorie intake for the past 7 days?')).reply).toContain('278.57 kcal/day');
    expect((await ask('What are my average logged calories per meal in the past 7 days?')).reply).toContain('390 kcal/entry');
  });
});
