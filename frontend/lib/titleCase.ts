/** Format catalog names for display without changing the saved value. */
export function titleCase(value: string): string {
  return value.replace(/[\p{L}\p{M}]+/gu, word => {
    if (word.length <= 4 && word === word.toLocaleUpperCase()) return word;
    const text = word.length > 4 && word === word.toLocaleUpperCase() ? word.toLocaleLowerCase() : word;
    return text[0].toLocaleUpperCase() + text.slice(1);
  });
}
