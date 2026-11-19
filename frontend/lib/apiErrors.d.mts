export class ApiNetworkError extends Error {
  constructor();
}

export function normalizeTransportError(error: unknown): unknown;
export function friendlyRequestMessage(status: number, message: unknown): string;
