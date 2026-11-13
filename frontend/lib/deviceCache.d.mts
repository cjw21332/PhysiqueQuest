export type CachedResource = 'profile' | 'nutrition' | 'activity' | 'coach' | 'notifications' | 'progress:weight' | 'progress:chest' | 'progress:waist' | 'progress:arms' | 'progress:benchPress' | 'workouts' | 'workout-summary' | 'exercise-library';
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
  invalidateExternal(keys: string[]): void;
  fetch<T>(key: CachedResource, load: () => Promise<T>, force?: boolean): Promise<T>;
  subscribe(listener: () => void): () => void;
};
