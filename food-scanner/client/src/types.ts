/**
 * Types the browser app consumes.
 *
 * The analysis types mirror the internal Food Scanner contract, because the
 * main backend proxies that service's responses through to the browser
 * unchanged. The log types are owned by the main backend: meal persistence was
 * moved out of Food Scanner, which is now a stateless analysis engine.
 */

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface AnalyzedItem {
  food_name: string;
  est_weight_g: number;
  confidence: number;
  found: boolean;
  fdc_id?: number;
  description?: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  per_100g?: Macros;
}

export interface AnalyzeResponse {
  request_id: string;
  model: string;
  items: AnalyzedItem[];
  /** Detected foods with no nutrition match. */
  unmatched: string[];
  totals: Macros;
  /** True when at least one nutrition lookup failed; results are partial. */
  degraded: boolean;
}

export interface FoodCandidate {
  fdc_id: number;
  description: string;
  data_type: string;
}

export interface FoodDetail {
  request_id: string;
  fdc_id: number;
  description: string;
  data_type: string;
  per_100g: Macros;
}

/** Shape of the main backend's error envelope, mirrored for error display. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Owned by the main backend
// ---------------------------------------------------------------------------

export interface LogItem {
  food_name: string;
  fdc_id?: number;
  weight_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export type LogTotals = Macros;

export interface LogPayload {
  items: LogItem[];
  totals: LogTotals;
}

export interface StoredLog {
  id: number;
  timestamp: string;
  payload: LogPayload;
}
