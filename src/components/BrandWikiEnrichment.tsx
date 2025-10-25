import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ENRICH_TTL_MS = 5 * 60 * 1000; // 5 minutes
const getLastEnrichedAt = (key: string) => {
  try {
    const ts = sessionStorage.getItem(key);
    return ts ? parseInt(ts) : 0;
  } catch {
    return 0;
  }
};
const setLastEnrichedAt = (key: string) => {
  try {
    sessionStorage.setItem(key, String(Date.now()));
  } catch {}
};

/**
 * Auto-enriches brands with Wikipedia data (description, parent company, key people, shareholders)
 * Runs silently in the background - no UI needed
 */
export function BrandWikiEnrichment({ 
  brandId, 
  hasDescription,
  hasParentCompany,
  hasKeyPeople,
  hasShareholders,
  onEnriched 
}: { 
  brandId: string, 
  hasDescription: boolean,
  hasParentCompany: boolean,
  hasKeyPeople: boolean,
  hasShareholders: boolean,
  onEnriched?: () => void 
}) {
  const inFlightRef = useRef(false);

  useEffect(() => {
    // Determine if we need full enrichment (people + shareholders) or just basic
    const needsFullEnrichment = !hasKeyPeople || !hasShareholders;
    const needsBasicEnrichment = !hasDescription || !hasParentCompany;
    const needsLogo = !brandId; // Will be checked in the enrichment call

    if (!needsBasicEnrichment && !needsFullEnrichment) return;

    // ALWAYS force full mode if key people are missing - this is critical
    const mode = needsFullEnrichment ? 'full' : undefined;
    const dedupeKey = `wiki_enrich:${brandId}:${mode ?? 'basic'}`;

    // TTL guard to avoid loops and rate limits
    const last = getLastEnrichedAt(dedupeKey);
    if (Date.now() - last < ENRICH_TTL_MS) {
      console.log('[Wiki] Skipping enrich due to recent attempt:', { brandId, mode });
      return;
    }

    // Trigger Wikipedia enrichment in the background
    const enrichBrand = async () => {
      if (inFlightRef.current) {
        console.log('[Wiki] Enrichment already in-flight, skipping:', brandId);
        return;
      }
      inFlightRef.current = true;
      try {
        console.log('[Wiki] Enriching brand:', brandId, 'mode:', mode, 'needs key people:', !hasKeyPeople);

        const { data, error } = await supabase.functions.invoke('enrich-brand-wiki', {
          body: {
            brand_id: brandId,
            mode
          }
        });

        if (error) {
          console.error('[Wiki] Error:', error);
        } else {
          console.log('[Wiki] Success:', data);
        }

        // Call enrich-ownership for parent company if needed
        if (!hasParentCompany) {
          console.log('[Wiki] Triggering ownership enrichment');
          const { data: ownershipData, error: ownershipError } = await supabase.functions.invoke('enrich-ownership', {
            body: {
              brand_id: brandId
            }
          });

          if (ownershipError) {
            console.error('[Wiki] Ownership enrichment error:', ownershipError);
          } else {
            console.log('[Wiki] Ownership enrichment success:', ownershipData);
          }
        }

        // Auto-trigger logo resolution if brand doesn't have one
        console.log('[Wiki] Checking for logo...');
        const { data: brandCheck } = await supabase
          .from('brands')
          .select('logo_url')
          .eq('id', brandId)
          .single();
        
        if (!brandCheck?.logo_url) {
          console.log('[Wiki] No logo found, triggering logo resolution');
          const { data: logoData, error: logoError } = await supabase.functions.invoke('resolve-brand-logo', {
            body: { brand_id: brandId }
          });
          
          if (logoError) {
            console.error('[Wiki] Logo resolution error:', logoError);
          } else {
            console.log('[Wiki] Logo resolution success:', logoData);
          }
        }

        // If enrichment was successful and updated the brand, trigger refetch
        if (data?.updated || data?.full_enrichment_completed) {
          // Delay refetch to give background processes time to complete
          setTimeout(() => {
            console.log('[Wiki] Triggering data refetch after enrichment');
            onEnriched?.();
          }, 2000);
        }
      } catch (error) {
        // Silent fail - not critical
        console.error('[Wiki] Exception:', error);
      } finally {
        // Record attempt regardless of outcome to prevent tight loops
        setLastEnrichedAt(dedupeKey);
        inFlightRef.current = false;
      }
    };

    // Trigger after a short delay to avoid race conditions
    const timer = setTimeout(enrichBrand, 1000);
    return () => clearTimeout(timer);
  }, [brandId, hasDescription, hasParentCompany, hasKeyPeople, hasShareholders, onEnriched]);

  return null; // No UI needed
}
