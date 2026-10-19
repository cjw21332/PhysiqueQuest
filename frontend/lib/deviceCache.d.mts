export type CachedResource = 'profile' | 'nutrition' | 'activity' | 'coach';
export type CacheState<T = any> = { data: T | undefined; savedAt?: number; refreshing: boolean; error: string };
export function createDeviceCache(options: {
  context: () => { scope: string; session: string } | null;
  storage: () => Storage | undefined;
  now?: () => number;
  validate?: (key: CachedResource, data: any) => boolean;
}): {
  get<T = any>(key: CachedResource): CacheState<T>;
  publish(key: CachedResource, data: unknown): void;
  invalidate(key: CachedResource): void;
  fetch<T>(key: CachedResource, load: () => Promise<T>, force?: boolean): Promise<T>;
  subscribe(listener: () => void): () => void;
};
