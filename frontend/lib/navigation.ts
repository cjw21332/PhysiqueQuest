let internalNavigate: ((path: string) => void) | null = null;
export function registerNavigation(handler: ((path: string) => void) | null) { internalNavigate = handler; }
export function navigate(path: string) {
  if (typeof window === 'undefined') return;
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Only app routes are supported.');
  if (internalNavigate) internalNavigate(path); else window.location.assign(path);
}
