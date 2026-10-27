import { describe, expect, it, vi } from 'vitest';
import { ChatService, cleanChatReply } from './chat.service.js';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn().mockResolvedValue({ text: 'Try a short walk.' }) }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent }; } }));

describe('Phiq chat', () => {
  it('removes formatting artifacts while retaining useful punctuation and links', () => {
    expect(cleanChatReply('Hi! **Strength Training:** Try *squats*.\n- Rest 2–3 minutes.\nSee [guidance](https://example.com).')).toBe('Hi! Strength Training: Try squats.\nRest 2–3 minutes.\nSee guidance (https://example.com).');
    expect(cleanChatReply('Use 2 * 3 reps.')).toBe('Use 2 * 3 reps.');
  });
  it('uses only the signed-in user’s selected data and sends conversation to Gemini', async () => {
    const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const findOne = vi.fn().mockResolvedValue({ name: 'Alex', goal: 'Build muscle', healthNotes: 'private', contactPhone: 'private' });
    const nutritionFind = vi.fn().mockReturnValue({ select: () => ({ lean: () => ({ exec: async () => ({ meals: [], water: [] }) }) }) });
    const workoutFind = vi.fn().mockReturnValue({ sort: () => ({ limit: () => ({ select: () => ({ lean: () => ({ exec: async () => [] }) }) }) }) });
    const service = new ChatService({ get: (name: string) => name === 'GEMINI_API_KEY' ? 'test-key' : undefined } as never, { collection: { findOne } } as never, { findOne: nutritionFind } as never, { find: workoutFind } as never, { get: vi.fn().mockResolvedValue({ state: { level: 7 } }) } as never, { getPlan: vi.fn() } as never, { list: vi.fn().mockResolvedValue([]) } as never, { get: vi.fn() } as never);
    expect(await service.reply(owner, [{ role: 'user', text: 'What should I do today?' }])).toEqual({ reply: 'Try a short walk.' });
    expect(String(findOne.mock.calls[0][0].userId)).toBe(owner);
    expect(String(nutritionFind.mock.calls[0][0].userId)).toBe(owner);
    expect(String(workoutFind.mock.calls[0][0].userId)).toBe(owner);
    const request = generateContent.mock.calls.at(-1)![0];
    expect(JSON.stringify(request.contents)).not.toContain('private');
    expect(JSON.stringify(request.contents)).toContain('Build muscle');
    expect(request.contents[0].parts[0].text).toContain('"level":7');
    expect(request.config.systemInstruction).toContain('never invent');
    generateContent.mockRejectedValueOnce({ status: 503 });
    expect(await service.reply(owner, [{ role: 'user', text: 'How are my quests?' }])).toEqual({ reply: 'Try a short walk.' });
  });
  it('rejects an empty conversation', async () => {
    const service = new ChatService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.reply('aaaaaaaaaaaaaaaaaaaaaaaa', [])).rejects.toThrow('Enter a message');
  });
});
