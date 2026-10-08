/**
 * Format phone number to Philippine format: 0999 999 9999
 * @param value - Raw phone number input
 * @returns Formatted phone number
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');

  // Limit to 11 digits (Philippine mobile format)
  const limited = digits.slice(0, 11);

  // Format as 0999 999 9999
  if (limited.length <= 4) {
    return limited;
  } else if (limited.length <= 7) {
    return `${limited.slice(0, 4)} ${limited.slice(4)}`;
  } else {
    return `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7)}`;
  }
}

/**
 * Remove formatting from phone number to get raw digits
 * @param formatted - Formatted phone number
 * @returns Raw digits only
 */
export function unformatPhoneNumber(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

/**
 * Validate Philippine mobile number format
 * @param phone - Phone number to validate
 * @returns true if valid Philippine mobile number
 */
export function validatePhoneNumber(phone: string): boolean {
  const digits = unformatPhoneNumber(phone);
  // Philippine mobile numbers: 11 digits starting with 09
  return /^09\d{9}$/.test(digits);
}
