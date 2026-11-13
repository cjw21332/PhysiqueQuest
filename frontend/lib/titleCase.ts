/** Format catalog names for display without changing the saved value. */
export function titleCase(value: string): string {
  const normalized = value.replace(/[_\s]+/gu, ' ').replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2').trim();
  return normalized.replace(/[\p{L}\p{M}]+/gu, word => {
    if (word.toLocaleLowerCase() === 'of') return 'of';
    if (/^(AI|HIIT|BMI|RM|RPE|PR|TRX|EZ|BOSU)$/u.test(word.toLocaleUpperCase())) return word.toLocaleUpperCase();
    const text = word.toLocaleLowerCase();
    return text[0].toLocaleUpperCase() + text.slice(1);
  });
}
