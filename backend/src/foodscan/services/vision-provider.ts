import type { ImageMimeType } from '../foodscan.schemas.js';
import type { TokenUsage } from '../foodscan-usage.service.js';

export const AI_VISION_PROVIDER = Symbol('AI_VISION_PROVIDER');
export interface DetectedItem {
  food_name: string; est_weight_g: number; confidence: number;
  localName?: string; searchTerms?: string[]; isComposite?: boolean; portionDescription?: string;
  evidence_claims?: Record<'name' | 'quantity' | 'preparation' | 'added_oil', { source: 'description' | 'image' | 'estimated' | 'unknown'; quote: string }>;
}
export interface VisionProvider {
  detectFoods(base64: string, mimeType: ImageMimeType, onUsage?: (usage: TokenUsage | null) => void, description?: string): Promise<DetectedItem[]>;
}
