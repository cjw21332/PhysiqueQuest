import { describe, expect, it, vi } from 'vitest';
import { ChatService } from './chat.service.js';
import { ChatContextService } from './chat-context.service.js';

const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
function fixture(plan: unknown = { goal: 'Maintenance', calories: 2000, protein: 30, carbs: 40, fat: 30 }) {
  const model = (record: unknown = null) => ({ collection: {
    findOne: vi.fn(async () => record),
    find: vi.fn(() => { const cursor = { sort: () => cursor, limit: () => cursor, toArray: async () => [] }; return cursor; }),
  } });
  const nutrition = model({ dietaryPlan: plan, meals: [], water: [] });
  const context = new ChatContextService(model() as never, nutrition as never, model() as never, model() as never, model() as never, model() as never, model() as never, { getForAssistant: vi.fn() } as never);
  const provider = { generate: vi.fn().mockRejectedValue(new Error('A saved diet plan must not require generation')) };
  return { service: new ChatService(context, provider as never), nutrition, provider };
}

describe('reported current diet plan failure', () => {
  it.each(["what's my current diet plan?", 'what’s my current diet plan?'])('answers the exact reported question from saved data: %s', async question => {
    const { service, nutrition, provider } = fixture();
    const result = await service.reply(owner, [{ role: 'user', text: question }], true, '/scan');
    expect(result.reply).not.toContain('Please ask about something in PhysiqueQuest');
    expect(result.reply).toMatch(/maintenance/i);
    expect(result.reply).toMatch(/2,?000/);
    expect(result.reply).toContain('30%');
    expect(result.reply).toContain('40%');
    expect(nutrition.collection.findOne).toHaveBeenCalled();
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it('asks for consent without reading records rather than rejecting the topic', async () => {
    const { service, nutrition } = fixture();
    const result = await service.reply(owner, [{ role: 'user', text: "what's my current diet plan?" }], false, '/scan');
    expect(result.reply).toMatch(/enable.*saved fitness data/i);
    expect(result.reply).not.toContain('Please ask about something in PhysiqueQuest');
    expect(nutrition.collection.findOne).not.toHaveBeenCalled();
  });
  it('explains an absent saved plan without inventing one or refusing system scope', async () => {
    const { service } = fixture(null);
    const result = await service.reply(owner, [{ role: 'user', text: "what's my current diet plan?" }], true, '/scan');
    expect(result.reply).toMatch(/no saved|not.*saved|unavailable/i);
    expect(result.reply).toMatch(/Scan|dietary plan/i);
    expect(result.reply).not.toContain('Please ask about something in PhysiqueQuest');
  });
});
