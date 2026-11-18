/** Server-only OpenAI transport. Never log request content, keys or provider errors. */
export const OPENAI_MODEL = 'gpt-6-luna';

export class OpenAIRequestError extends Error {
  constructor(readonly status: number) { super('OpenAI request failed'); }
}

export async function openAIResponse(input: unknown, maxOutputTokens: number, signal: AbortSignal, model: string = OPENAI_MODEL) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new OpenAIRequestError(0);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', redirect: 'error', signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input, max_output_tokens: maxOutputTokens, store: false, text: { format: { type: 'json_object' } } }),
  });
  if (!response.ok) { await response.body?.cancel(); throw new OpenAIRequestError(response.status); }
  const body = await response.json() as { status?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } };
  if (body.status !== 'completed') throw new Error('Incomplete OpenAI response');
  const content = body.output?.flatMap(item => item.content ?? []).find(item => item.type === 'output_text')?.text;
  if (!content || content.length > 32768) throw new Error('Invalid OpenAI response');
  return { content, usage: body.usage };
}
