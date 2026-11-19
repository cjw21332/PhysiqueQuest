/**
 * Prepares a captured photo for the food scan endpoint.
 *
 * Two things have to happen before the bytes are sent. The backend only accepts
 * JPEG, PNG or WebP and identifies the format from the bytes themselves, so an
 * iPhone HEIC photo has to be re-encoded rather than forwarded. And the request
 * travels as base64 inside a JSON body capped at 4 MiB of decoded image, which a
 * modern phone photo exceeds by a wide margin, so it is downscaled first.
 *
 * Re-encoding through a canvas solves both at once and costs no extra round trip.
 */

/** Longest edge kept. Large enough for the vision model, small enough to upload. */
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;
const MAX_BYTES = 4 * 1024 * 1024;
const UNSUPPORTED = "This photo format isn't supported. Please choose a JPEG, PNG or WebP image.";

export interface ScanImagePayload {
  base64: string;
  mimeType: 'image/jpeg';
}

export async function toScanImage(file: File): Promise<ScanImagePayload> {
  if (file.type && !file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error(UNSUPPORTED);
  const { source, release } = await loadBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
    let width = Math.max(1, Math.round(source.width * scale));
    let height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot process the photo.');
    for (;;) {
      canvas.width = width;
      canvas.height = height;
      context.drawImage(source, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const separator = dataUrl.indexOf(',');
      if (separator < 0 || !dataUrl.startsWith('data:image/jpeg;base64,')) throw new Error('That photo could not be encoded.');
      const base64 = dataUrl.slice(separator + 1);
      if (Math.floor(base64.length * 3 / 4) <= MAX_BYTES) return { base64, mimeType: 'image/jpeg' };
      if (width <= 1 && height <= 1) throw new Error('That photo is too large to process. Please choose another photo.');
      width = Math.max(1, Math.floor(width * 0.8));
      height = Math.max(1, Math.floor(height * 0.8));
    }
  } finally {
    release();
  }
}

async function loadBitmap(file: File): Promise<{ source: CanvasImageSource & { width: number; height: number }; release: () => void }> {
  // `from-image` applies the EXIF rotation, without which a portrait photo
  // reaches the model sideways.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, release: () => bitmap.close() };
    } catch {
      // Older WebViews expose the function but reject some files; fall through.
    }
  }

  const url = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => { URL.revokeObjectURL(url); reject(new Error(UNSUPPORTED)); };
    element.src = url;
  });
  return { source: image, release: () => URL.revokeObjectURL(url) };
}
