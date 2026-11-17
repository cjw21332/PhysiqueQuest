import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAIResponse, OpenAIRequestError } from './openai.js';
import { orderPlanWithOpenAI } from '../coach/openai-plan.js';
import { CoachPlanner } from '../coach/coach-planner.js';
import { OpenAIVisionService } from '../foodscan/services/openai-vision.service.js';

const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => { vi.unstubAllGlobals(); if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
const response = (value: unknown) => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }], usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 } }), { status: 200 });

describe('OpenAI integration', () => {
  it('sends only to Luna and disables response storage', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await openAIResponse([{ role: 'user', content: 'test' }], 100, AbortSignal.timeout(1000));
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(JSON.parse(request.body)).toMatchObject({ model: 'gpt-6-luna', store: false, max_output_tokens: 100 });
    expect(JSON.parse(result.content)).toEqual({ ok: true });
  });
  it('does not expose upstream error content', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret provider response', { status: 401 })));
    await expect(openAIResponse([], 100, AbortSignal.timeout(1000))).rejects.toEqual(new OpenAIRequestError(401));
  });
  it('validates food detection and maps usage', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const mock = vi.fn().mockResolvedValue(response({ items: [{ food_name: 'rice', est_weight_g: 120, confidence: 0.8 }] }));
    vi.stubGlobal('fetch', mock);
    const vision = new OpenAIVisionService({ value: { upstreamTimeoutMs: 1000, maxDetectedItems: 12 } } as never);
    const onUsage = vi.fn();
    expect(await vision.detectFoods('dGVzdA==', 'image/jpeg', onUsage)).toEqual([{ food_name: 'rice', est_weight_g: 120, confidence: 0.8 }]);
    expect(onUsage).toHaveBeenCalledWith({ input: 5, output: 3, total: 8 });
    const request = JSON.parse(mock.mock.calls[0][1].body);
    expect(request.input[0].content[1].image_url).toBe('data:image/jpeg;base64,dGVzdA==');
  });
  it('rejects malformed food output', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ items: [{ food_name: 'rice', est_weight_g: -2, confidence: 5 }] })));
    const vision = new OpenAIVisionService({ value: { upstreamTimeoutMs: 1000, maxDetectedItems: 12 } } as never);
    await expect(vision.detectFoods('dGVzdA==', 'image/jpeg')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });
  it('rejects a model adding an exercise to a workout', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const plan = new CoachPlanner().build({ goal: 'Build muscle', days: ['Monday'], equipment: ['Full gym'] }, [
      { id: 'a', name: 'Bench Press', group: 'Chest', targetMuscle: 'chest', equipment: 'Barbell', pose: '', instructions: [] },
    ]);
    expect(plan.days[0].exercises.length).toBe(1);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ days: [{ index: 0, exerciseIds: ['invented'] }] })));
    await expect(orderPlanWithOpenAI(plan)).rejects.toThrow('Invalid workout exercises');
  });
});
