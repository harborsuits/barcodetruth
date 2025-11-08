/**
 * Normalize company names for better EPA matching
 */

const SUFFIXES = [
  'Inc', 'Inc.', 'LLC', 'L.L.C.', 'Ltd', 'Ltd.', 'Limited',
  'PLC', 'Corp', 'Corp.', 'Corporation', 'Company', 'Co', 'Co.',
  'LP', 'LLP', 'L.P.', 'L.L.P.', 'AG', 'GmbH', 'S.A.', 'N.V.'
];

export function normalizeCompanyName(name: string): string {
  // Remove special characters and extra spaces
  let normalized = name
    .replace(/[^\w\s&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove common suffixes
  for (const suffix of SUFFIXES) {
    const pattern = new RegExp(`\\b${suffix}\\b`, 'gi');
    normalized = normalized.replace(pattern, '').trim();
  }
  
  return normalized;
}

/**
 * Generate name variants for better matching
 */
export function generateVariants(name: string): string[] {
  const variants = new Set<string>();
  
  // Original name
  variants.add(name);
  
  // Normalized name
  const normalized = normalizeCompanyName(name);
  if (normalized !== name) {
    variants.add(normalized);
  }
  
  // Without "The" prefix
  const withoutThe = name.replace(/^The\s+/i, '').trim();
  if (withoutThe !== name) {
    variants.add(withoutThe);
    variants.add(normalizeCompanyName(withoutThe));
  }
  
  // With common suffixes removed
  const withoutSuffix = name.replace(/\b(Inc|LLC|Ltd|Corp|Company)\b\.?/gi, '').trim();
  if (withoutSuffix !== name) {
    variants.add(withoutSuffix);
  }
  
  return Array.from(variants).filter(v => v.length > 0);
}
