import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  useEffect(() => {
    // Determine if we need full enrichment (people + shareholders) or just basic
    const needsFullEnrichment = !hasKeyPeople || !hasShareholders;
    const needsBasicEnrichment = !hasDescription || !hasParentCompany;
    
    if (!needsBasicEnrichment && !needsFullEnrichment) return;
    
    // Trigger Wikipedia enrichment in the background
    const enrichBrand = async () => {
      try {
        const mode = needsFullEnrichment ? 'full' : undefined;
        console.log('[Wiki] Enriching brand:', brandId, 'mode:', mode);
        
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
          // If enrichment was successful and updated the brand, trigger refetch
          if (data?.updated || data?.full_enrichment_completed) {
            onEnriched?.();
          }
        }
      } catch (error) {
        // Silent fail - not critical
        console.error('[Wiki] Exception:', error);
      }
    };
    
    // Trigger after a short delay to avoid race conditions
    const timer = setTimeout(enrichBrand, 1000);
    return () => clearTimeout(timer);
  }, [brandId, hasDescription, hasParentCompany, hasKeyPeople, hasShareholders, onEnriched]);
  
  return null; // No UI needed
}
