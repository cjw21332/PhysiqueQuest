/** Keep the launch requirement and the green readiness indicator in agreement. */
export function deviceOsStatus(platform, version) {
  if (platform === 'android') {
    return { title: 'Android 12 or higher', ready: Number.parseInt(version ?? '', 10) >= 12 };
  }
  if (platform === 'ios') return { title: 'iOS device', ready: Boolean(version) };
  return { title: 'Device compatibility', ready: false };
}
