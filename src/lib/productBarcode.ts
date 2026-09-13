/** Retail formats supported by the current scanner; preserves leading zeros. */
export function normalizeProductBarcode(value: string | undefined): string | null {
  if (!value || !/^(?:\d{8}|\d{12}|\d{13})$/.test(value)) return null;
  return value.length === 12 ? `0${value}` : value;
}
