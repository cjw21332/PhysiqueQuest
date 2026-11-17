export const foodScanRegion = { x: 0.1, y: 0.2, width: 0.8, height: 0.6 };
export type FoodPreviewFrame = { x: number; y: number; width: number; height: number };
export function foodPhotoCrop(sourceWidth: number, sourceHeight: number, viewWidth: number, viewHeight: number) {
  const scale = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const w = viewWidth / scale, h = viewHeight / scale;
  return { x: (sourceWidth-w)/2 + foodScanRegion.x*w, y: (sourceHeight-h)/2 + foodScanRegion.y*h, width: foodScanRegion.width*w, height: foodScanRegion.height*h };
}
