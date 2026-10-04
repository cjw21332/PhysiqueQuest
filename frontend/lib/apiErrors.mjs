export class ApiNetworkError extends Error {
  constructor() {
    super('Could not reach the PhysiqueQuest API. Check your network connection and API address.');
    this.name = 'ApiNetworkError';
  }
}

/** @param {unknown} error @returns {unknown} */
export function normalizeTransportError(error) {
  return error instanceof TypeError ? new ApiNetworkError() : error;
}
