/** Server-only OpenAI transport. Never log request content, keys or provider errors. */
export const OPENAI_MODEL = 'gpt-6-luna';

export class OpenAIRequestError extends Error {
  constructor(readonly status: number) { super('OpenAI request failed'); }
}

export async function openAIResponse(input: unknown, maxOutputTokens: number, signal: AbortSignal, model = OPENAI_MODEL, schema?: object, webSearch = false): Promise<{ content: string; usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined; citations?: string[] }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new OpenAIRequestError(0);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', redirect: 'error', signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input, max_output_tokens: maxOutputTokens, store: false, ...(webSearch ? { tools: [{ type: 'web_search' }], tool_choice: 'required', include: ['web_search_call.action.sources'] } : { text: { format: schema ? { type: 'json_schema', name: 'meal_detection', strict: true, schema } : { type: 'json_object' } } }) }),
  });
  if (!response.ok) { await response.body?.cancel(); throw new OpenAIRequestError(response.status); }
  const body = await response.json() as { status?: string; output?: Array<{ action?: { sources?: Array<{ url?: string }> }; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string }> }> }>; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } };
  if (body.status !== 'completed') throw new Error('Incomplete OpenAI response');
  const content = body.output?.flatMap(item => item.content ?? []).find(item => item.type === 'output_text')?.text;
  if (!content || content.length > 32768) throw new Error('Invalid OpenAI response');
  const citations = [...(body.output?.flatMap(item => item.content ?? []).flatMap(item => item.annotations ?? []).filter(item => item.type === 'url_citation' && typeof item.url === 'string').map(item => item.url!) ?? []), ...(body.output?.flatMap(item => item.action?.sources ?? []).flatMap(source => source.url ? [source.url] : []) ?? [])];
  return { content, usage: body.usage, citations };
}
