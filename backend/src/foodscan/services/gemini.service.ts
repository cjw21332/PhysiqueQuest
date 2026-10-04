import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, type ThinkingLevel } from '@google/genai';
import { FoodScanConfigService } from '../../common/foodscan/foodscan-config.js';
import {
  AppError,
  ErrorCode,
  serviceUnavailable,
  upstreamTimeout,
  upstreamUnavailable,
} from '../../common/foodscan/errors.js';
import {
  currentDeadline,
  remainingMs,
  type Deadline,
} from '../../common/foodscan/deadline-context.js';
import type { ImageMimeType } from '../foodscan.schemas.js';

const responseSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          food_name: {
            type: 'STRING',
            description: 'Common English name of the food item, singular where possible.',
          },
          est_weight_g: {
            type: 'NUMBER',
            description: 'Estimated edible weight of this item in grams.',
          },
          confidence: {
            type: 'NUMBER',
            description: 'Confidence in the identification, 0 to 1.',
          },
        },
        required: ['food_name', 'est_weight_g', 'confidence'],
      },
    },
  },
  required: ['items'],
};

const PROMPT = `You are a food recognition system for a calorie & macro tracker.
Analyze the image and identify every distinct edible food item visible.
For each item estimate its edible weight in grams based on typical plate,
utensil, and portion sizes visible in the image. Be realistic and conservative.
If the image contains no clear food, return an empty items array.
Identify only foods, not drinks, unless a drink is clearly the main item.`;

const MODEL_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9.]+)*$/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DetectedItem {
  food_name: string;
  est_weight_g: number;
  confidence: number;
}

/**
 * Slack between the last possible upstream abort and the request deadline. It
 * only has to cover the abort propagating out of the SDK, because an attempt is
 * never started unless its whole budget fits inside the deadline.
 */
const DEADLINE_SLACK_MS = 500;
const RETRY_BACKOFF_MS = 750;

/**
 * Provider refusals that no retry can fix. Matched before the transient check
 * because a busy-provider message can also contain "try again", which would
 * otherwise spend the caller's remaining quota to no effect.
 */
function isQuotaRefusal(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /\b429\b|quota|rate limit|resource exhausted/i.test(message);
}

/** Gemini answers 503 UNAVAILABLE while a model is under load. */
function isTransient(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /\b503\b|UNAVAILABLE|high demand|overloaded|try again/i.test(message);
}

/**
 * The upstream budget for one attempt, never long enough to outlive the request
 * deadline. Returns less than `upstreamTimeoutMs` when the deadline cannot
 * accommodate a full attempt, which is the signal to stop rather than start one.
 */
function attemptBudgetMs(upstreamTimeoutMs: number, deadline: Deadline | undefined): number {
  const left = remainingMs(deadline);
  if (!Number.isFinite(left)) return upstreamTimeoutMs;
  return Math.min(upstreamTimeoutMs, left - DEADLINE_SLACK_MS);
}

/** Whether a further attempt still fits inside the deadline. */
function attemptFits(upstreamTimeoutMs: number, deadline: Deadline | undefined): boolean {
  return attemptBudgetMs(upstreamTimeoutMs, deadline) >= upstreamTimeoutMs;
}

/** Whether a further attempt still fits once `backoffMs` of waiting has passed. */
function attemptFitsAfter(
  upstreamTimeoutMs: number,
  deadline: Deadline | undefined,
  backoffMs: number
): boolean {
  if (!deadline) return true;
  return deadline.deadlineAt - Date.now() - backoffMs - DEADLINE_SLACK_MS >= upstreamTimeoutMs;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private client?: GoogleGenAI;

  constructor(private readonly config: FoodScanConfigService) {}

  /** The SDK client is stateless per request, so one instance is reused. */
  private getClient(): GoogleGenAI {
    this.client ??= new GoogleGenAI({ apiKey: this.config.value.gemini.apiKey });
    return this.client;
  }

  async detectFoods(base64: string, mimeType: ImageMimeType): Promise<DetectedItem[]> {
    const cfg = this.config.value;

    if (!cfg.gemini.configured) {
      throw serviceUnavailable('Vision model is not configured on this service', {
        missing_env: 'GEMINI_API_KEY',
      });
    }
    if (!MODEL_ID.test(cfg.gemini.model)) {
      throw serviceUnavailable('Configured vision model identifier is malformed', {
        invalid_env: 'GEMINI_MODEL',
      });
    }

    let result;
    const attempts = cfg.gemini.attempts;
    const deadline = currentDeadline();
    for (let attempt = 1; ; attempt++) {
      // Budget for this attempt alone. An attempt is only started when its full
      // upstream budget fits inside the deadline: a shorter one would be
      // cancelled by the deadline rather than by its own timeout, and the caller
      // would get the generic TIMEOUT instead of the accurate
      // UPSTREAM_TIMEOUT. The signal is composed with the deadline so the
      // deadline also cancels the call directly, not just via this timer.
      if (!attemptFits(cfg.upstreamTimeoutMs, deadline)) {
        this.logger.warn(
          `gemini_budget_exhausted model=${cfg.gemini.model} - ${Math.max(0, Math.round(remainingMs(deadline)))}ms left, not enough for a full attempt`
        );
        throw upstreamTimeout('vision model');
      }
      const budget = attemptBudgetMs(cfg.upstreamTimeoutMs, deadline);
      const timeoutSignal = AbortSignal.timeout(budget);
      try {
        result = await this.getClient().models.generateContent({
          model: cfg.gemini.model,
          contents: [
            {
              role: 'user',
              parts: [{ text: PROMPT }, { inlineData: { mimeType, data: base64 } }],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
            thinkingConfig: {
              // The config layer validates this against the SDK's level names as
              // plain strings so it stays free of SDK imports; the cast is where
              // that string becomes the SDK's nominal enum.
              thinkingLevel: cfg.gemini.thinkingLevel as ThinkingLevel,
            },
            abortSignal: deadline ? AbortSignal.any([timeoutSignal, deadline.signal]) : timeoutSignal,
          },
        });
        break;
      } catch (cause) {
        // The deadline already produced the client's response. Reporting a
        // second failure for a call we deliberately cancelled would log a
        // timeout after the request was answered, which reads as a new fault.
        if (deadline?.signal.aborted) {
          throw upstreamTimeout('vision model');
        }
        // Quota refusals are final: another attempt spends the caller's
        // remaining quota for the same answer and delays it.
        if (isQuotaRefusal(cause)) {
          throw this.mapGeminiError(cause, cfg.gemini.model);
        }
        // Gemini answers 503 UNAVAILABLE while a model is under load, which is
        // transient rather than a broken request. It is only worth another
        // attempt when the remaining budget can still hold a full one: a retry
        // that cannot finish before the deadline would be cancelled by it, and
        // the caller would get the generic TIMEOUT instead of the accurate
        // UPSTREAM_TIMEOUT.
        const backoff = RETRY_BACKOFF_MS * attempt;
        if (attempt < attempts && isTransient(cause)) {
          if (!attemptFitsAfter(cfg.upstreamTimeoutMs, deadline, backoff)) {
            this.logger.warn(
              `gemini_budget_exhausted model=${cfg.gemini.model} - ${Math.max(0, Math.round(remainingMs(deadline)))}ms left after attempt ${attempt}, skipping retry`
            );
            throw upstreamTimeout('vision model');
          }
          this.logger.warn(
            `gemini_retry model=${cfg.gemini.model} attempt=${attempt}/${attempts} - vision provider busy`
          );
          await sleep(backoff);
          continue;
        }
        throw this.mapGeminiError(cause, cfg.gemini.model);
      }
    }

    const parsed = extractJson(result.text ?? '');
    const raw: unknown[] = Array.isArray(parsed?.items) ? parsed.items : [];

    const items = raw
      .slice(0, cfg.maxDetectedItems)
      .map((entry) => {
        const i = (entry ?? {}) as Record<string, unknown>;
        return {
          food_name: String(i.food_name ?? '').trim(),
          est_weight_g: Math.round(clamp(Number(i.est_weight_g), 1, 5000)),
          confidence: clamp(Number(i.confidence), 0, 1),
        };
      })
      .filter((i) => i.food_name.length > 0);

    if (raw.length > cfg.maxDetectedItems) {
      this.logger.warn(
        `detected_items_truncated detected=${raw.length} kept=${items.length} - vision model returned more items than the per-request cap`
      );
    }

    return items;
  }

  private mapGeminiError(cause: unknown, model: string): AppError {
    const name = cause instanceof Error ? cause.name : '';
    const message = cause instanceof Error ? cause.message : String(cause);

    if (name === 'TimeoutError' || name === 'AbortError' || /abort|timeout/i.test(message)) {
      this.logger.error(`gemini_timeout model=${model} - vision call exceeded its time budget`);
      return upstreamTimeout('vision model');
    }
    if (/\b(401|403)\b|API key|apiKey|permission/i.test(message)) {
      this.logger.error(`gemini_auth_failure model=${model} - vision provider rejected our credentials`);
      return serviceUnavailable('Vision provider rejected the configured credentials', {
        upstream: 'gemini',
      });
    }
    if (/\b429\b|quota|rate limit|resource exhausted/i.test(message)) {
      this.logger.error(`gemini_rate_limited model=${model} - vision provider rate limit reached`);
      // 429 rather than 502: the provider is refusing on quota, not broken, and
      // the caller's correct response is to wait instead of retrying at once.
      return new AppError(ErrorCode.PROVIDER_RATE_LIMITED, 'The food scanner is busy right now. Wait a moment, then try again.', {
        details: { upstream: 'gemini' },
      });
    }

    // The provider message can embed the request URL and account details, so it
    // is logged but not returned.
    return upstreamUnavailable('vision model', `gemini call failed (model=${model}): ${message}`, cause);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function extractJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}