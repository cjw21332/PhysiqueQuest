/** Only expose known error categories, never provider messages or tokens. */
export function googleSignInError(error: unknown): { cancelled?: boolean; error?: string } {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'SIGN_IN_CANCELLED' || code === '12501') return { cancelled: true };
  if (code === '10' || code === 'DEVELOPER_ERROR') return { error: 'Google sign-in is not configured correctly in this app version. Install the latest PhysiqueQuest update. (G10)' };
  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') return { error: 'Google Play services needs to be installed or updated. Update it, then try Google sign-in again.' };
  if (code === 'IN_PROGRESS' || code === '12502') return { error: 'Google sign-in is already open. Finish that request before trying again.' };
  if (code === '7' || code === 'NETWORK_ERROR') return { error: 'Google could not be reached. Check your internet connection and try again. (G7)' };
  return { error: 'Google sign-in could not be completed. Try again or use email and password. (G_UNKNOWN)' };
}
