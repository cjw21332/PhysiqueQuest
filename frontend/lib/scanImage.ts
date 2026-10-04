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

export interface ScanImagePayload {
  base64: string;
  mimeType: 'image/jpeg';
}

export async function toScanImage(file: File): Promise<ScanImagePayload> {
  const { source, release } = await loadBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot process the photo.');
    context.drawImage(source, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const separator = dataUrl.indexOf(',');
    if (separator < 0) throw new Error('That photo could not be encoded.');
    return { base64: dataUrl.slice(separator + 1), mimeType: 'image/jpeg' };
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
    element.onerror = () => reject(new Error('That file could not be read as an image.'));
    element.src = url;
  });
  return { source: image, release: () => URL.revokeObjectURL(url) };
}
