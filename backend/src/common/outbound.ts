type Circuit = { failures: number; openUntil: number; probing: boolean };
const circuits = new Map<string, Circuit>();
export function resetOutboundCircuits() { circuits.clear(); }
export async function withCircuit<T>(key: string, operation: () => Promise<T>, failed: (result: T) => boolean = () => false): Promise<T> {
  let circuit = circuits.get(key);
  if (!circuit) {
    if (circuits.size >= 64) circuits.delete(circuits.keys().next().value!);
    circuit = { failures: 0, openUntil: 0, probing: false }; circuits.set(key, circuit);
  }
  const now = Date.now();
  if (circuit.openUntil > now || circuit.probing) throw new Error('Upstream circuit open. Try again later.');
  const probe = circuit.openUntil !== 0;
  if (probe) circuit.probing = true;
  const failure = () => { circuit!.failures++; if (probe || circuit!.failures >= 5) circuit!.openUntil = Date.now() + 30_000; };
  try {
    const result = await operation();
    if (failed(result)) failure(); else { circuit.failures = 0; circuit.openUntil = 0; }
    return result;
  } catch (error) { failure(); throw error; }
  finally { if (probe) circuit.probing = false; }
}
export async function outboundFetch(url: string, options: RequestInit = {}) {
  const origin = new URL(url).origin;
  return withCircuit(origin, () => fetch(url, { ...options, redirect: 'error', signal: options.signal ?? AbortSignal.timeout(10_000) }), response => response.status === 429 || response.status >= 500);
}
