/**
 * Shared brand normalization logic
 * Used across seed-products, merge-products, smart-product-lookup, and frontend search
 */

// Common corporate suffixes to strip for matching
const CORPORATE_SUFFIXES = [
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company',
  'llc', 'ltd', 'limited', 'plc', 'gmbh', 'sa', 'ag', 'nv',
  'holdings', 'group', 'brands', 'foods', 'beverages',
  'international', 'global', 'worldwide', 'enterprises',
];

export function normalizeBrandLabel(label: string | null | undefined): string {
  if (!label) return '';
  
  return label
    .toLowerCase()
    .replace(/^xx:/i, '') // Strip "xx:" prefix
    .replace(/[-_&]+/g, ' ') // Hyphens, underscores, ampersands → space
    .replace(/[''`]/g, "'") // Normalize quotes
    .replace(/[^\w\s']/g, ' ') // Strip other punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip corporate suffixes for fuzzy matching
 * e.g. "The Kraft Heinz Company" → "kraft heinz"
 */
export function stripCorporateSuffixes(normalized: string): string {
  let result = normalized.toLowerCase().replace(/^the\s+/, '');
  for (const suffix of CORPORATE_SUFFIXES) {
    // Remove trailing suffix with optional comma/period
    result = result.replace(new RegExp(`[,.]?\\s+${suffix}\\.?$`, 'i'), '');
  }
  return result.trim();
}

/**
 * Generate a slug from a brand name for matching
 */
export function brandNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function capitalizeBrandName(normalized: string): string {
  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
