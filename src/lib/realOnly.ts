/**
 * Real + Cited Only - Verification Helpers
 * 
 * These functions ensure we only show data backed by verified events with sources.
 * No baseline scores, no Wikipedia fallbacks, no synthetic data.
 */

export interface VerifiableBrand {
  last_event_at?: string | null;
  last_updated?: string | null; // alternative field name
  evidence?: any[];
  score?: number | null;
  _real_only?: { hasEvent: boolean; hasEvidence: boolean }; // backend verification flag
}

/**
 * Check if a brand has verified events with sources
 * Returns true only if:
 * 1. Brand has at least one verified event (last_event_at or last_updated exists)
 * 2. Brand has at least one evidence link
 * 
 * Trusts backend _real_only flag if present
 */
export const isVerifiedBrand = (brand: VerifiableBrand | null | undefined): boolean => {
  if (!brand) return false;
  
  // If backend provides _real_only verification, trust it
  if (brand._real_only) {
    return brand._real_only.hasEvent && brand._real_only.hasEvidence;
  }
  
  // Otherwise check manually
  const hasEvent = Boolean(brand.last_event_at || brand.last_updated);
  const hasEvidence = Array.isArray(brand.evidence) && brand.evidence.length > 0;
  return hasEvent && hasEvidence;
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
