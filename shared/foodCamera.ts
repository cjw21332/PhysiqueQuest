export const foodScanRegion = { x: 0.1, y: 0.2, width: 0.8, height: 0.6 };
export type FoodPreviewFrame = { x: number; y: number; width: number; height: number };
export function foodPhotoCrop(sourceWidth: number, sourceHeight: number, viewWidth: number, viewHeight: number) {
  const scale = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const w = viewWidth / scale, h = viewHeight / scale;
  return { x: (sourceWidth-w)/2 + foodScanRegion.x*w, y: (sourceHeight-h)/2 + foodScanRegion.y*h, width: foodScanRegion.width*w, height: foodScanRegion.height*h };
}
export function barcodeInsideFoodFrame(bounds: { origin: { x: number; y: number }; size: { width: number; height: number } } | undefined, width: number, height: number) {
  if (!bounds) return false;
  const { origin: p, size: s } = bounds;
  return [p.x,p.y,s.width,s.height].every(Number.isFinite) && s.width > 0 && s.height > 0 &&
    p.x >= width*foodScanRegion.x && p.y >= height*foodScanRegion.y &&
    p.x+s.width <= width*(foodScanRegion.x+foodScanRegion.width) && p.y+s.height <= height*(foodScanRegion.y+foodScanRegion.height);
}
