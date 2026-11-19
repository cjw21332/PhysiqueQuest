// Explicit opt-in: live requests can be billable. Never prints secrets or raw responses.
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { FoodScanConfigService } from '../dist/common/foodscan/foodscan-config.js';
import { HttpService } from '../dist/common/foodscan/http.service.js';
import { GeminiService } from '../dist/foodscan/services/gemini.service.js';
import { UsdaService } from '../dist/foodscan/services/usda.service.js';

if (!process.argv.includes('--live')) { process.stderr.write('Pass --live to make provider requests.\n'); process.exit(2); }
const index = process.argv.indexOf('--mode');
const mode = index >= 0 ? process.argv[index + 1] : process.argv.includes('--usda-only') ? 'usda' : process.argv.includes('--gemini-only') ? 'structured' : 'all';
if (!['metadata', 'rest-text', 'text', 'image', 'structured', 'app', 'usda', 'all'].includes(mode)) { process.stderr.write('Mode must be metadata, rest-text, text, image, structured, app, usda or all.\n'); process.exit(2); }
const config = new FoodScanConfigService(new ConfigService());
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const out = { model: config.value.gemini.model, mode, image: { kind: 'synthetic', width: 1, height: 1, mime: 'image/png', bytes: Buffer.from(png, 'base64').length }, stages: {} };
const category = error => { if (typeof error?.code === 'string' && /TIMEOUT/.test(error.code)) return 'TIMEOUT'; if (/abort|timeout/i.test(String(error?.name ?? ''))) return 'TIMEOUT'; const status = Number(error?.status ?? error?.statusCode); if (status === 401 || status === 403) return 'AUTH'; if (status === 429) return 'RATE_LIMIT'; if (status >= 500) return 'PROVIDER_UNAVAILABLE'; if (typeof error?.code === 'string') return error.code; return 'UNKNOWN'; };
async function run(name, action) { const started = Date.now(); try { out.stages[name] = { status: 'ok', duration_ms: Date.now() - started, ...await action() }; out.stages[name].duration_ms = Date.now() - started; } catch (error) { out.stages[name] = { status: 'failed', duration_ms: Date.now() - started, category: category(error) }; } }
const selected = name => mode === 'all' || mode === name;
if (['metadata', 'rest-text', 'text', 'image', 'structured'].some(selected) && !config.value.gemini.configured) out.stages.gemini = { status: 'skipped', reason: 'GEMINI_API_KEY not configured' };
else if (config.value.gemini.configured) {
  const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.value.gemini.model)}`;
  if (selected('metadata')) await run('metadata', async () => { const response = await fetch(modelUrl, { headers: { 'x-goog-api-key': config.value.gemini.apiKey }, signal: AbortSignal.timeout(config.value.upstreamTimeoutMs) }); if (!response.ok) throw Object.assign(new Error('Metadata failed'), { status: response.status }); return { http_status: response.status }; });
  if (selected('rest-text')) await run('rest-text', async () => { const response = await fetch(`${modelUrl}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': config.value.gemini.apiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply OK.' }] }] }), signal: AbortSignal.timeout(config.value.upstreamTimeoutMs) }); if (!response.ok) throw Object.assign(new Error('Generation failed'), { status: response.status }); const data = await response.json(); return { http_status: response.status, usage_available: !!data.usageMetadata }; });
  const client = new GoogleGenAI({ apiKey: config.value.gemini.apiKey });
  const call = async parts => { const response = await client.models.generateContent({ model: config.value.gemini.model, contents: [{ role: 'user', parts }], config: { abortSignal: AbortSignal.timeout(config.value.upstreamTimeoutMs) } }); return { response_present: !!response.text, usage_available: !!response.usageMetadata }; };
  if (selected('text')) await run('text', () => call([{ text: 'Reply OK.' }]));
  if (selected('image')) await run('image', () => call([{ text: 'Describe this image briefly.' }, { inlineData: { mimeType: 'image/png', data: png } }]));
  if (selected('structured')) await run('structured', async () => { let usage = null; const items = await new GeminiService(config).detectFoods(png, 'image/png', value => { usage = value; }); return { valid_item_count: items.length, usage }; });
}
if (selected('app')) {
  const url = process.env.FOODSCAN_DIAGNOSTIC_URL, token = process.env.FOODSCAN_DIAGNOSTIC_TOKEN;
  if (!url || !token) out.stages.app = { status: 'skipped', reason: 'FOODSCAN_DIAGNOSTIC_URL or FOODSCAN_DIAGNOSTIC_TOKEN not configured' };
  else await run('app', async () => { const endpoint = new URL(url); if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Invalid endpoint'); const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ image: png, mimeType: 'image/png' }), signal: AbortSignal.timeout(config.value.requestTimeoutMs + 5000) }); if (!response.ok) throw Object.assign(new Error('Application request failed'), { status: response.status }); const body = await response.json(); if (!Array.isArray(body.items)) throw new Error('Invalid scanner response'); return { http_status: response.status, valid_item_count: body.items.length }; });
}
if (selected('usda')) {
  if (!config.value.usda.configured) out.stages.usda = { status: 'skipped', reason: 'USDA_API_KEY not configured' };
  else await run('usda', async () => {
    const service = new UsdaService(config, new HttpService(config));
    const candidates = await service.searchCandidates('white rice cooked', 3);
    if (!candidates.length) throw new Error('No candidates');
    const detail = await service.getNutrients(candidates[0].fdc_id);
    let invalid = 'unexpected_success'; try { await service.getNutrients(999999999999); } catch (error) { invalid = error.code ?? 'unknown'; }
    const matching = [];
    for (const query of ['white rice cooked', 'raw chicken breast', 'fried egg']) {
      const match = await service.lookupFood(query);
      matching.push({ query, matched: !!match, ...(match ? { id: match.fdcId, description: match.description, data_type: match.dataType } : {}) });
    }
    return { result_count: candidates.length, record_id: detail.fdcId, description: detail.description, available_nutrients: ['kcal_per_100g', 'carbs_g_per_100g', 'protein_g_per_100g', 'fat_g_per_100g'].filter(key => detail[key] !== null), invalid_record: invalid, matching };
  });
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
if (Object.values(out.stages).some(stage => stage.status !== 'ok')) process.exitCode = 1;
