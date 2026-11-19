import { createHash, createHmac } from 'node:crypto';

/**
 * Separate, versioned consent for donating recordings to model development.
 * Camera permission and PoseTracker use are NOT this consent: nothing is
 * contributed unless the user accepts this text, and accepting is per-account.
 * Bump CONSENT_VERSION (and this text) whenever the terms change; stored
 * consents keep the hash of the text the user actually accepted.
 */
export const CONSENT_VERSION = '2026-11-16.v1';

export const CONSENT_TEXT = [
  'PhysiqueQuest model development contribution',
  '',
  'What you contribute: body keypoint coordinates from PoseTracker (33 points per frame, 15 frames per second),',
  'the exercise you selected, whether the camera was front or back facing, the video orientation, the duration,',
  'the repetition boundaries your session produced, and the app version.',
  '',
  'What is never uploaded by this feature: video, photographs, faces, audio, your name, your email, or your account id.',
  'Your contributed clips are labelled with a random per-account study code, not your identity.',
  'The study code is derived from a server-held secret and cannot be reversed by anyone with the dataset.',
  '',
  'Why: to train and evaluate the on-device movement-pattern model. Contributed clips may be included in a dataset',
  'that is shared for research under the dataset licence recorded in the export manifest.',
  '',
  'This is separate from camera permission and from normal PoseTracker use. Ordinary sessions are never added',
  'automatically. You choose per recording whether to contribute it, and you can withdraw everything at any time',
  'from the same screen; withdrawal deletes your contributed clips and their payloads from our storage.',
  '',
  'You can keep using PoseTracker without contributing.',
].join('\n');

export function consentTextHash(text: string = CONSENT_TEXT): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Stable pseudonym for a user. The secret is never stored with the dataset, so
 * subject codes cannot be linked back to accounts from an exported dataset.
 */
export function pseudonymize(userId: string, secret: string): string {
  if (!secret || secret.length < 16) throw new Error('dataset pseudonym secret is not configured');
  return createHmac('sha256', secret).update(`dataset:${userId}`).digest('hex').slice(0, 24);
}
