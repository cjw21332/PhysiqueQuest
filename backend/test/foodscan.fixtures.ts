/** A real 1x1 PNG. Decodes to bytes starting with the PNG signature. */
export const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** A real 1x1 JPEG, for asserting that the declared type does not override bytes. */
export const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

/** Valid base64, but not an image: must be rejected on magic bytes, not decoding. */
export const NOT_AN_IMAGE_BASE64 = Buffer.from(
  'this payload is plain text, not an image of any kind at all'
).toString('base64');

/** A base64 string with characters outside the alphabet. */
export const MALFORMED_BASE64 = '!!!!not-valid-base64!!!!';

export const JSON_HEADERS = { 'content-type': 'application/json' } as const;
