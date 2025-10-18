import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-enriches brands with Wikipedia descriptions when they're viewed
 * Runs silently in the background - no UI needed
 */
export function BrandWikiEnrichment({ brandId, hasDescription }: { brandId: string; hasDescription: boolean }) {
  useEffect(() => {
    // Skip if already has a description
    if (hasDescription) return;
    
    // Trigger Wikipedia enrichment in the background
    const enrichBrand = async () => {
      try {
        console.log('[WikiEnrich] Enriching brand:', brandId);
        await supabase.functions.invoke('enrich-brand-wiki', {
          body: { brand_id: brandId }
        });
      } catch (error) {
        // Silent fail - not critical for user experience
        console.error('[WikiEnrich] Failed:', error);
      }
    };
    
    // Debounce to avoid multiple calls
    const timer = setTimeout(enrichBrand, 1000);
    return () => clearTimeout(timer);
  }, [brandId, hasDescription]);
  
  return null; // No UI needed
}
