/**
 * Category Evidence Integrity: Normalization Layer
 * 
 * Ensures all category values are normalized to canonical forms before
 * database insert/update to prevent cross-category contamination in UI.
 * 
 * Database enforces these via CHECK constraint: labor | environment | politics | social
 */

export type CategoryKey = 'labor' | 'environment' | 'politics' | 'social';

/**
 * Normalizes any incoming category string to canonical form.
 * 
 * @param raw - Input category from various sources (API, manual, classification)
 * @returns Canonical category value safe for database insert
 * 
 * @example
 * normalizeCategory('Labor Rights') // => 'labor'
 * normalizeCategory('ENV') // => 'environment'
 * normalizeCategory('political') // => 'politics'
 * normalizeCategory('unknown') // => 'social' (fallback)
 */
export function normalizeCategory(raw: string | null | undefined): CategoryKey {
  if (!raw) return 'social';
  
  const normalized = raw.toLowerCase().trim();
  
  if (normalized.startsWith('labor') || normalized.includes('worker') || normalized.includes('employment')) {
    return 'labor';
  }
  
  if (normalized.startsWith('env') || normalized.includes('climate') || normalized.includes('pollution')) {
    return 'environment';
  }
  
  if (normalized.startsWith('politic') || normalized.includes('lobby') || normalized.includes('campaign')) {
    return 'politics';
  }
  
  // Default to social for social, diversity, community, or unknown
  return 'social';
}

/**
 * Type guard to check if a value is a valid canonical category.
 */
export function isValidCategory(value: unknown): value is CategoryKey {
  return typeof value === 'string' && 
    ['labor', 'environment', 'politics', 'social'].includes(value);
}
