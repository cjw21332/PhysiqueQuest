import { spawn } from 'node:child_process';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';

const baseModel = 'qwen3.5:4b';
const customModel = 'physiquequest-phiq';
const warmup = process.argv.includes('--warmup');
const checkOnly = process.argv.includes('--check') || warmup;

function privateUrl(value) {
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const parts = host.split('.').map(Number);
  const privateV4 = isIP(host) === 4 && (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (!privateV4 && !['localhost', '127.0.0.1', '::1', 'ollama'].includes(host))) {
    throw new Error('CHAT_OLLAMA_URL must be a private Ollama origin (loopback, private IPv4, or the ollama container hostname).');
  }
  return url.origin;
}

const origin = privateUrl(process.env.CHAT_OLLAMA_URL || 'http://127.0.0.1:11434');
const model = checkOnly ? (process.env.CHAT_OLLAMA_MODEL || customModel).trim() : customModel;
if (!/^[a-z0-9][a-z0-9_.-]*(?::[a-z0-9_.-]+)?$/i.test(model) || /cloud/i.test(model)) throw new Error('A local model name is required.');

async function inspectLocalModel(name) {
  const response = await fetch(`${origin}/api/show`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: name }),
  });
  if (!response.ok) throw new Error(`Local model ${name} is unavailable (HTTP ${response.status}). Run npm run ai:setup.`);
  const info = await response.json();
  if (info.remote_model || info.remote_host || !info.model_info || Object.keys(info.model_info).length === 0 || !info.capabilities?.includes('completion')) {
    throw new Error(`Model ${name} is not a locally installed completion model. Cloud models are not allowed.`);
  }
  return info;
}

function runOllama(args) {
  return new Promise((resolve, reject) => {
    // Explicit target and local-only flag apply to this CLI child; an already
    // running daemon needs OLLAMA_NO_CLOUD set in its own service environment.
    const child = spawn('ollama', args, { shell: false, windowsHide: true, env: { ...process.env, OLLAMA_HOST: origin, OLLAMA_NO_CLOUD: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const capture = chunk => { tail = (tail + chunk.toString()).slice(-4000); };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', () => reject(new Error('Ollama CLI was not found. Install Ollama and start its local service first.')));
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ollama ${args[0]} failed (exit ${code}): ${tail.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').trim().slice(-700)}`));
    });
  });
}

try {
  if (!checkOnly) {
    console.log(`Downloading local ${baseModel} weights (about 4 GB; reused when already present)...`);
    await runOllama(['pull', baseModel]);
    await inspectLocalModel(baseModel);
    console.log(`Creating the ${customModel} application model...`);
    await runOllama(['create', customModel, '-f', fileURLToPath(new URL('./Modelfile', import.meta.url))]);
  }
  const info = await inspectLocalModel(model);
  if (warmup) {
    console.log(`Loading ${model} into inference memory (cold starts may take a few minutes)...`);
    const response = await fetch(`${origin}/api/chat`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(180000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [], stream: false, think: false, keep_alive: process.env.CHAT_KEEP_ALIVE || '30m', options: { num_ctx: 8192, num_predict: 1 } }),
    });
    if (!response.ok) throw new Error(`Local model warmup failed (HTTP ${response.status}).`);
    const result = await response.json();
    if (result.done !== true || result.error) throw new Error('Local model did not finish loading.');
  }
  console.log(`Ready: ${model}; local weights verified; ${info.details?.parameter_size || 'open-weight'}; no AI API key required.`);
  console.log(warmup
    ? 'Warmup sent an empty message list only; it did not access the database or send personal data.'
    : 'This check reads model metadata only; it does not access the database or send personal data.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local model setup failed.');
  process.exitCode = 1;
}
