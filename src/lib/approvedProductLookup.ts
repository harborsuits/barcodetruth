/** External lookup and navigation identities are hints, not published records. */
export async function lookupApprovedProduct<T>(options: {
  barcodes: string[];
  readByBarcode: (barcode: string) => Promise<T | null>;
  lookup: () => Promise<unknown>;
  readById: (id: string) => Promise<T | null>;
}): Promise<T | null> {
  for (const barcode of [...new Set(options.barcodes)]) {
    const approved = await options.readByBarcode(barcode);
    if (approved) return approved;
  }
  const hint = await options.lookup();
  if (!hint || typeof hint !== 'object' || !('id' in hint) || typeof hint.id !== 'string' || !hint.id) return null;
  return options.readById(hint.id);
}
