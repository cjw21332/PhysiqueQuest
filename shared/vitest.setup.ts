// Shared vitest setup
import { vi } from 'vitest';

// Mock any browser globals if needed
globalThis.performance = globalThis.performance || {
  now: () => Date.now(),
};