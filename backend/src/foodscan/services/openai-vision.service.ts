import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { FoodScanConfigService } from '../../common/foodscan/foodscan-config.js';
import { currentDeadline } from '../../common/foodscan/deadline-context.js';
import { AppError, ErrorCode, serviceUnavailable, upstreamTimeout, upstreamUnavailable } from '../../common/foodscan/errors.js';
import { openAIResponse, OpenAIRequestError } from '../../common/openai.js';
import type { ImageMimeType } from '../foodscan.schemas.js';
import type { TokenUsage } from '../foodscan-usage.service.js';

const resultSchema = z.object({ items: z.array(z.object({
  food_name: z.string().trim().min(1).max(120), est_weight_g: z.number().finite().min(1).max(5000), confidence: z.number().finite().min(0).max(1),
})) });

@Injectable()
export class OpenAIVisionService {
  constructor(private readonly config: FoodScanConfigService) {}
  async detectFoods(base64: string, mimeType: ImageMimeType, onUsage?: (usage: TokenUsage | null) => void) {
    const deadline = currentDeadline();
    const timeout = AbortSignal.timeout(this.config.value.upstreamTimeoutMs);
    try {
      const result = await openAIResponse([{ role: 'user', content: [
        { type: 'input_text', text: 'Identify distinct visible edible foods in this image. Return JSON {"items":[{"food_name":string,"est_weight_g":number,"confidence":number}]}. Estimate edible grams conservatively and confidence from 0 to 1. Separate visible foods, do not double count mixed dishes, do not invent obscured items; return an empty array when no food is clear.' },
        { type: 'input_image', image_url: `data:${mimeType};base64,${base64}`, detail: 'low' },
      ] }], 1000, deadline ? AbortSignal.any([timeout, deadline.signal]) : timeout);
      const usage = result.usage;
      const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
      onUsage?.(usage ? { input: count(usage.input_tokens), output: count(usage.output_tokens), total: count(usage.total_tokens) } : null);
      const parsed = resultSchema.parse(JSON.parse(result.content));
      if (parsed.items.length > this.config.value.maxDetectedItems) throw new Error('Too many items');
      return parsed.items;
    } catch (error) {
      if (deadline?.signal.aborted || timeout.aborted) throw upstreamTimeout('vision model');
      if (error instanceof OpenAIRequestError && error.status === 429) throw new AppError(ErrorCode.PROVIDER_RATE_LIMITED, 'The food scanner is busy right now. Wait a moment, then try again.');
      if (error instanceof OpenAIRequestError && [0, 401, 403].includes(error.status)) throw serviceUnavailable('Vision provider is not configured or rejected its credentials');
      throw upstreamUnavailable('vision model', 'OpenAI vision request failed');
    }
  }
}
