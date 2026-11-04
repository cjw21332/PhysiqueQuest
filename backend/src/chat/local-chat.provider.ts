import { Injectable, ServiceUnavailableException, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { CHAT_CONFIG_KEYS, chatConfig, isPrivateChatAddress } from './chat-config.js';
import { SEMANTIC_ROUTING_INSTRUCTIONS, SEMANTIC_ROUTING_PRECISION, SEMANTIC_SCHEMA, completeSemanticPlan, parseSemanticPlan, semanticCandidates, semanticHints, type SemanticPlan } from './chat-semantic-router.js';

export type LocalChatMessage = { role: 'system' | 'user'; content: string };
export type GroundedReply = { inScope: boolean; answer: string; sourceIds: string[] };
type ChatSettings = ReturnType<typeof chatConfig>;

async function readJson(response: Response, maxBytes: number): Promise<Record<string, unknown>> {
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Private inference unavailable');
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Private inference response too large');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid inference response');
    return parsed as Record<string, unknown>;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/**
 * DNS is resolved on every request, all answers must be private, and one validated
 * address is pinned into the socket lookup. A rebind cannot redirect private text.
 * Literal private IPs use fetch; they do not perform a second DNS resolution.
 */
async function privateRequest(settings: ChatSettings, path: string, body: unknown | undefined, signal: AbortSignal): Promise<Response> {
  signal.throwIfAborted();
  const url = new URL(settings.url + '/api/' + path);
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  const method = serialized === undefined ? 'GET' : 'POST';
  if (isIP(settings.hostname)) return fetch(url.toString(), {
    method, headers: serialized === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: serialized, redirect: 'error', signal,
  });
  const addresses = await lookup(settings.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => !isPrivateChatAddress(item.address))) throw new Error('Inference DNS must resolve privately');
  const chosen = addresses[0];
  return new Promise<Response>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method, signal, family: chosen.family, agent: false,
      headers: serialized === undefined ? undefined : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(serialized) },
      lookup: (_hostname, _options, callback) => callback(null, chosen.address, chosen.family),
    }, response => {
      const status = response.statusCode ?? 502;
      if (status >= 300 && status < 400) { response.destroy(); reject(new Error('Inference redirects are forbidden')); return; }
      resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status }));
    });
    request.once('error', reject);
    request.end(serialized);
  });
}

@Injectable()
export class LocalChatProvider implements OnApplicationBootstrap, OnModuleDestroy {
  private active = 0;
  private verified?: { key: string; expiresAt: number };
  private checking?: { key: string; promise: Promise<void> };
  private warming?: Promise<{ ready: boolean }>;
  private maintenance?: ReturnType<typeof setInterval>;
  private readonly shutdown = new AbortController();
  constructor(private readonly config: ConfigService) {}

  private settings() { return chatConfig(Object.fromEntries(CHAT_CONFIG_KEYS.map(key => [key, this.config.get(key)]))); }
  private signal(timeoutMs: number) { return AbortSignal.any([AbortSignal.timeout(timeoutMs), this.shutdown.signal]); }
  private async checkModel(settings: ChatSettings, signal: AbortSignal) {
    const key = settings.url + '\n' + settings.model;
    if (this.verified?.key === key && this.verified.expiresAt > Date.now()) return;
    if (this.checking?.key === key) return this.checking.promise;
    this.verified = undefined;
    const promise = (async () => {
      const info = await readJson(await privateRequest(settings, 'show', { model: settings.model }, signal), 262144);
      if (info.remote_model || info.remote_host || /(?:^|\n)\s*FROM\s+[^\n]*cloud/i.test(String(info.modelfile ?? ''))) throw new Error('Remote model forbidden');
      if (!info.details || typeof info.details !== 'object' || !info.model_info || typeof info.model_info !== 'object' ||
        !Object.keys(info.model_info).length || !Array.isArray(info.capabilities) || !info.capabilities.includes('completion')) throw new Error('Private model not installed');
      if (this.checking?.key === key) this.verified = { key, expiresAt: Date.now() + settings.modelCheckTtlMs };
    })();
    this.checking = { key, promise };
    try { await promise; } finally { if (this.checking?.promise === promise) this.checking = undefined; }
  }

  /** No host, model identifier, conversation, user data, or provider errors are exposed. */
  async status(): Promise<{ ready: boolean }> {
    try {
      const settings = this.settings(), signal = this.signal(Math.min(settings.timeoutMs, 5000));
      await this.checkModel(settings, signal);
      const result = await readJson(await privateRequest(settings, 'ps', undefined, signal), 32768);
      const canonical = (value: unknown) => typeof value === 'string' ? value.replace(/:latest$/, '') : '';
      return { ready: Array.isArray(result.models) && result.models.some(model => {
        const entry = model as Record<string, unknown>;
        return canonical(entry.name) === canonical(settings.model) || canonical(entry.model) === canonical(settings.model);
      }) };
    } catch { return { ready: false }; }
  }

  /** Startup/prewarm only: sends an empty message list, never user or database data. */
  async warmup(): Promise<{ ready: boolean }> {
    if (this.warming) return this.warming;
    const operation = (async () => {
      const settings = this.settings();
      if (this.active >= settings.maxConcurrency) return { ready: false };
      this.active++;
      try {
        const signal = this.signal(settings.warmupTimeoutMs);
        await this.checkModel(settings, signal);
        const result = await readJson(await privateRequest(settings, 'chat', {
          model: settings.model, messages: [], stream: false, think: false, keep_alive: settings.keepAlive,
          options: { num_ctx: settings.contextTokens, num_predict: 1 },
        }, signal), 32768);
        return { ready: result.done === true && !result.error };
      } catch { this.verified = undefined; return { ready: false }; }
      finally { this.active--; }
    })();
    this.warming = operation;
    try { return await operation; } finally { if (this.warming === operation) this.warming = undefined; }
  }

  onApplicationBootstrap() {
    const settings = this.settings();
    if (!settings.warmupEnabled) return;
    void this.warmup().catch(() => undefined);
    if (settings.keepAliveSeconds > 0) {
      const intervalMs = Math.max(1000, Math.min(15 * 60000, Math.floor(settings.keepAliveSeconds * 800)));
      this.maintenance = setInterval(() => { if (!this.active) void this.warmup().catch(() => undefined); }, intervalMs);
      this.maintenance.unref();
    }
  }
  onModuleDestroy() {
    if (this.maintenance) clearInterval(this.maintenance);
    this.shutdown.abort();
  }

  /** Meaning-only planning: no account records, IDs, database tools or free-form queries. */
  async routeQuestion(question: string, previousUserQuestions: readonly string[] = [], page?: string): Promise<SemanticPlan> {
    const settings = this.settings();
    if (this.active >= settings.maxConcurrency) throw new ServiceUnavailableException('Phiq is busy. Please try again shortly.');
    this.active++;
    try {
      const signal = this.signal(Math.min(settings.timeoutMs, 20000));
      await this.checkModel(settings, signal);
      const candidates = semanticCandidates(question, previousUserQuestions, page);
      const evidence = semanticHints(question, previousUserQuestions, page);
      const maxRoutes = evidence.compound || evidence.topics.length > 1 || evidence.nutrients.length > 1 || evidence.measurementMetrics.length > 1 ? 3 : 1;
      const format = { ...SEMANTIC_SCHEMA, properties: { ...SEMANTIC_SCHEMA.properties, routeIds: { ...SEMANTIC_SCHEMA.properties.routeIds, maxItems: maxRoutes, items: { type: 'string', enum: [...candidates.map(route => route.id), 'clarify', 'out_of_scope', 'boundary'] } } } };
      const result = await readJson(await privateRequest(settings, 'chat', {
        model: settings.model, stream: false, think: false, truncate: false, shift: false, keep_alive: settings.keepAlive,
        messages: [
          { role: 'system', content: SEMANTIC_ROUTING_INSTRUCTIONS + '\n' + SEMANTIC_ROUTING_PRECISION + '\nSupported routes: ' + JSON.stringify(candidates.map(({ id, description }) => ({ id, description }))) },
          { role: 'user', content: JSON.stringify({ question: question.slice(0, 2000), previousUserQuestions: previousUserQuestions.slice(-3).map(value => value.slice(0, 600)), page, literalEvidence: { ...evidence, resolved: evidence.resolved.slice(-2000) } }) },
        ],
        format,
        options: { temperature: 0, num_ctx: settings.contextTokens, num_predict: Math.min(settings.maxOutputTokens, 256) },
      }, signal), 16384);
      const message = result.message as Record<string, unknown> | undefined;
      if (result.done !== true || result.done_reason === 'length' || message?.tool_calls || typeof message?.content !== 'string') throw new Error('Invalid semantic plan');
      const plan = parseSemanticPlan(JSON.parse(message.content));
      if (!plan || plan.routeIds.length > maxRoutes || plan.routeIds.some(id => !candidates.some(route => route.id === id))) throw new Error('Unsupported semantic plan');
      return completeSemanticPlan(plan, evidence);
    } catch {
      this.verified = undefined;
      throw new ServiceUnavailableException('Phiq could not interpret that question right now. Please rephrase it.');
    } finally { this.active--; }
  }

  async generate(messages: LocalChatMessage[], sourceIds: string[]): Promise<GroundedReply> {
    const settings = this.settings();
    if (this.active >= settings.maxConcurrency) throw new ServiceUnavailableException('Phiq is busy. Please try again shortly.');
    this.active++;
    try {
      const signal = this.signal(settings.timeoutMs);
      await this.checkModel(settings, signal);
      const schema = {
        type: 'object', additionalProperties: false, required: ['inScope', 'answer', 'sourceIds'],
        properties: {
          inScope: { type: 'boolean' }, answer: { type: 'string', maxLength: 4000 },
          sourceIds: { type: 'array', maxItems: 8, items: { type: 'string', enum: sourceIds } },
        },
      };
      const result = await readJson(await privateRequest(settings, 'chat', {
        model: settings.model, messages, stream: false, think: false, truncate: false, shift: false, format: schema,
        keep_alive: settings.keepAlive, options: { temperature: 0.1, num_ctx: settings.contextTokens, num_predict: settings.maxOutputTokens },
      }, signal), 32768);
      const message = result.message as Record<string, unknown> | undefined;
      if (result.done !== true || result.done_reason === 'length' || message?.tool_calls || typeof message?.content !== 'string') throw new Error('Invalid private response');
      const reply: unknown = JSON.parse(message.content);
      if (!reply || typeof reply !== 'object') throw new Error('Invalid grounded response');
      const parsed = reply as GroundedReply;
      if (Object.keys(parsed).some(key => !['inScope', 'answer', 'sourceIds'].includes(key)) || typeof parsed.inScope !== 'boolean' || typeof parsed.answer !== 'string' || !parsed.answer.trim() || parsed.answer.length > 4000 ||
        !Array.isArray(parsed.sourceIds) || parsed.sourceIds.length > 8 || parsed.sourceIds.some(id => typeof id !== 'string' || !sourceIds.includes(id)) ||
        (parsed.inScope && !parsed.sourceIds.length)) throw new Error('Unsupported response sources');
      return parsed;
    } catch {
      this.verified = undefined;
      throw new ServiceUnavailableException('Phiq’s private model is unavailable right now. Please try again later.');
    } finally { this.active--; }
  }
}
