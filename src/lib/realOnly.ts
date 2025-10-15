/**
 * Real + Cited Only - Verification Helpers
 * 
 * These functions ensure we only show data backed by verified events with sources.
 * No baseline scores, no Wikipedia fallbacks, no synthetic data.
 */

export interface VerifiableBrand {
  last_event_at?: string | null;
  evidence?: any[];
  score?: number | null;
}

/**
 * Check if a brand has verified events with sources
 * Returns true only if:
 * 1. Brand has at least one verified event (last_event_at exists)
 * 2. Brand has at least one evidence link
 */
export const isVerifiedBrand = (brand: VerifiableBrand | null | undefined): boolean => {
  if (!brand) return false;
  return Boolean(
    brand.last_event_at && 
    Array.isArray(brand.evidence) && 
    brand.evidence.length > 0
  );
};

/**
 * Gate score display - only show if verified
 */
export const getDisplayScore = (brand: VerifiableBrand | null | undefined): number | null => {
  return isVerifiedBrand(brand) ? (brand?.score ?? null) : null;
};

/**
 * Gate summary display - only show if verified
 */
export const canShowSummary = (brand: VerifiableBrand | null | undefined): boolean => {
  return isVerifiedBrand(brand);
};
