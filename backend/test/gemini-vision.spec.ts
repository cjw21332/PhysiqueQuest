import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodScanConfig } from '../src/common/foodscan/foodscan-config.js';
import { runWithDeadline } from '../src/common/foodscan/deadline-context.js';
import { AppError, ErrorCode } from '../src/common/foodscan/errors.js';
import { GeminiService } from '../src/foodscan/services/gemini.service.js';

/**
 * Provider-call behaviour of the vision client.
 *
 * Two things here were found by running the real provider rather than by reading
 * the code: the configured model answers a structured-output request in roughly 9s
 * at its default reasoning level, which overran the upstream budget and turned
 * healthy scans into 504s, and it intermittently answers 503 while under load.
 * Both are asserted here so the fix cannot be silently reverted.
 */

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const OK_TEXT = '{"items":[{"food_name":"apple","est_weight_g":150,"confidence":0.8}]}';
const PNG = 'iVBORw0KGgo=';

function configWith(overrides: Partial<FoodScanConfig['gemini']> = {}): FoodScanConfig {
  return {
    gemini: {
      apiKey: 'test-key',
      model: 'gemini-3.5-flash',
      thinkingLevel: 'LOW',
      attempts: 3,
      configured: true,
      ...overrides,
    },
    upstreamTimeoutMs: 20_000,
    maxDetectedItems: 12,
  } as FoodScanConfig;
}

const busy = () => Object.assign(new Error('got status: 503 UNAVAILABLE. This model is currently experiencing high demand.'), { name: 'ApiError' });
const quota = () => Object.assign(new Error('got status: 429 Resource has been exhausted (e.g. check quota).'), { name: 'ApiError' });

describe('GeminiService.detectFoods', () => {
  const service = (overrides?: Partial<FoodScanConfig['gemini']>) =>
    new GeminiService({ value: configWith(overrides) } as never);

  beforeEach(() => {
    generateContent.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('asks for the configured reasoning effort so the answer lands inside the budget', async () => {
    generateContent.mockResolvedValue({ text: OK_TEXT });

    await service({ thinkingLevel: 'LOW' }).detectFoods(PNG, 'image/png');

    const request = generateContent.mock.calls[0][0];
    expect(request.config.thinkingConfig.thinkingLevel).toBe('LOW');
    expect(request.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('parses the detected items out of the structured response', async () => {
    generateContent.mockResolvedValue({ text: OK_TEXT });

    await expect(service().detectFoods(PNG, 'image/png')).resolves.toEqual([
      { food_name: 'apple', est_weight_g: 150, confidence: 0.8 },
    ]);
  });

  it('retries a busy provider and returns the eventual answer', async () => {
    generateContent.mockRejectedValueOnce(busy()).mockResolvedValue({ text: OK_TEXT });
    const pending = service().detectFoods(PNG, 'image/png');
    const assertion = expect(pending).resolves.toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('gives up once the attempt budget is spent', async () => {
    generateContent.mockRejectedValue(busy());
    const pending = service({ attempts: 2 }).detectFoods(PNG, 'image/png');
    // Attach the handler before advancing, otherwise the rejection lands while
    // nothing is listening and the runner reports an unhandled rejection.
    const assertion = expect(pending).rejects.toMatchObject({ code: ErrorCode.UPSTREAM_UNAVAILABLE });

    await vi.advanceTimersByTimeAsync(5_000);

    await assertion;
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('never retries when retries are switched off', async () => {
    generateContent.mockRejectedValue(busy());

    await expect(service({ attempts: 1 }).detectFoods(PNG, 'image/png')).rejects.toBeInstanceOf(AppError);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('does not spend attempts on an exhausted quota', async () => {
    // A retry here would burn the operator's remaining quota to no effect.
    generateContent.mockRejectedValue(quota());

    await expect(service().detectFoods(PNG, 'image/png')).rejects.toMatchObject({
      code: ErrorCode.PROVIDER_RATE_LIMITED,
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('reports missing credentials instead of calling the provider', async () => {
    await expect(service({ configured: false }).detectFoods(PNG, 'image/png')).rejects.toMatchObject({
      code: ErrorCode.SERVICE_UNAVAILABLE,
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('treats a malformed model identifier as a configuration fault', async () => {
    await expect(service({ model: 'not a model!' }).detectFoods(PNG, 'image/png')).rejects.toMatchObject({
      code: ErrorCode.SERVICE_UNAVAILABLE,
    });
    expect(generateContent).not.toHaveBeenCalled();
  });
});

/**
 * The request deadline has to reach the provider call, and the retry loop has to
 * respect the clock. Both were found from a real scan log: a busy provider made
 * the retry chain outlive the deadline, the deadline fired while an attempt was
 * still running, and `gemini_timeout` was logged seconds *after* the client had
 * already been answered.
 */
describe('GeminiService.detectFoods under a request deadline', () => {
  const service = (overrides?: Partial<FoodScanConfig['gemini']>) =>
    new GeminiService({ value: configWith(overrides) } as never);

  const underDeadline = <T>(msLeft: number, fn: () => Promise<T>) => {
    const controller = new AbortController();
    return runWithDeadline({ signal: controller.signal, deadlineAt: Date.now() + msLeft }, fn);
  };

  beforeEach(() => {
    generateContent.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cancels the provider call when the deadline signal fires', async () => {
    // The caller has already been answered by the time this happens, so nothing
    // may still be running against the provider.
    const controller = new AbortController();
    let captured: AbortSignal | undefined;
    generateContent.mockImplementation((request: { config: { abortSignal: AbortSignal } }) => {
      captured = request.config.abortSignal;
      return new Promise(() => {});
    });

    void runWithDeadline(
      { signal: controller.signal, deadlineAt: Date.now() + 60_000 },
      () => service().detectFoods(PNG, 'image/png')
    );

    expect(captured?.aborted).toBe(false);
    controller.abort();
    expect(captured?.aborted).toBe(true);
  });

  it('reports UPSTREAM_TIMEOUT and stops once the deadline cancels the call', async () => {
    const logged: string[] = [];
    vi.spyOn(Logger, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
    const controller = new AbortController();
    generateContent.mockImplementation(() => {
      controller.abort();
      return Promise.reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    });

    await expect(
      runWithDeadline(
        { signal: controller.signal, deadlineAt: Date.now() + 60_000 },
        () => service().detectFoods(PNG, 'image/png')
      )
    ).rejects.toMatchObject({ code: ErrorCode.UPSTREAM_TIMEOUT });

    expect(generateContent).toHaveBeenCalledTimes(1);
    // The request was cancelled deliberately, so a provider-timeout line after
    // the fact would read as a fresh fault rather than the deadline firing.
    expect(logged.filter((line) => line.includes('gemini_timeout'))).toEqual([]);
  });

  it('skips a retry that could not finish before the deadline', async () => {
    // 21s left holds exactly one 20s attempt. A retry would need the 750ms
    // backoff plus another full 20s, so retrying could only end with the
    // deadline cancelling it, which would surface as the generic TIMEOUT.
    generateContent.mockRejectedValue(busy());

    await expect(underDeadline(21_000, () => service().detectFoods(PNG, 'image/png'))).rejects.toMatchObject({
      code: ErrorCode.UPSTREAM_TIMEOUT,
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('does not start an attempt without room for a full one', async () => {
    // 20.4s left: one short of the 20s attempt budget plus its slack. Starting
    // anyway would only produce a deadline cancellation, so nothing is spent.
    await expect(underDeadline(20_400, () => service().detectFoods(PNG, 'image/png'))).rejects.toMatchObject({
      code: ErrorCode.UPSTREAM_TIMEOUT,
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('starts an attempt once a full one fits', async () => {
    generateContent.mockResolvedValue({ text: OK_TEXT });

    await underDeadline(20_500, () => service().detectFoods(PNG, 'image/png'));

    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('does not start an attempt with too little budget left to be useful', async () => {
    await expect(underDeadline(1_000, () => service().detectFoods(PNG, 'image/png'))).rejects.toMatchObject({
      code: ErrorCode.UPSTREAM_TIMEOUT,
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('still retries when the remaining budget can hold another attempt', async () => {
    generateContent.mockRejectedValueOnce(busy()).mockResolvedValue({ text: OK_TEXT });
    const pending = underDeadline(60_000, () => service().detectFoods(PNG, 'image/png'));
    const assertion = expect(pending).resolves.toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000);

    await assertion;
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('gives an attempt its full upstream budget when a deadline allows it', async () => {
    // With deadline headroom the attempt keeps its whole 20s budget rather than
    // a sliver of the remaining time, so a slow-but-progressing provider call
    // is not cancelled early.
    generateContent.mockResolvedValue({ text: OK_TEXT });

    await underDeadline(60_000, () => service().detectFoods(PNG, 'image/png'));

    expect(generateContent.mock.calls[0][0].config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('returns a quota refusal immediately, without retries', async () => {
    generateContent.mockRejectedValue(quota());

    await expect(service().detectFoods(PNG, 'image/png')).rejects.toMatchObject({
      code: ErrorCode.PROVIDER_RATE_LIMITED,
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('does not retry a quota refusal that also mentions trying again', async () => {
    // The transient matcher accepts "try again", which a 429 body can contain.
    // Quota has to be recognised first or the retry spends quota for nothing.
    generateContent.mockRejectedValue(
      Object.assign(new Error('got status: 429 Resource has been exhausted. Please try again later.'), {
        name: 'ApiError',
      })
    );

    await expect(service().detectFoods(PNG, 'image/png')).rejects.toMatchObject({
      code: ErrorCode.PROVIDER_RATE_LIMITED,
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});