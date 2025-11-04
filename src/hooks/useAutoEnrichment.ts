import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface EnrichmentProgress {
  status: 'idle' | 'enriching' | 'complete' | 'failed';
  message: string;
  step: number;
  totalSteps: number;
}

export function useAutoEnrichment(brandId: string, brandName: string, needsEnrichment: boolean) {
  const [progress, setProgress] = useState<EnrichmentProgress>({
    status: 'idle',
    message: '',
    step: 0,
    totalSteps: 3
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    // Skip enrichment for placeholder/invalid brand names
    if (!brandName || 
        brandName.toLowerCase().includes('unnamed') || 
        brandName.toLowerCase().includes('placeholder') ||
        brandName.trim() === '') {
      console.log('[AutoEnrich] Skipping enrichment for placeholder/invalid brand name:', brandName);
      return;
    }

    if (!needsEnrichment || progress.status !== 'idle') return;

    async function enrichBrand() {
      try {
        setProgress({
          status: 'enriching',
          message: `Finding and validating ${brandName}...`,
          step: 1,
          totalSteps: 3
        });

        // Step 1: Use enrich-brand-wiki edge function (has proper entity validation)
        console.log('[AutoEnrich] Calling enrich-brand-wiki for:', brandName);
        
        const { data: enrichData, error: enrichError } = await supabase.functions.invoke('enrich-brand-wiki', {
          body: { 
            brand_id: brandId,
            mode: 'basic' // Just get QID + description, not full enrichment
          }
        });

        // Handle enrichment response gracefully
        if (enrichError) {
          throw new Error('Enrichment service error');
        }
        
        if (!enrichData?.success) {
          // Not found in Wikidata - this is OK, just skip enrichment
          if (enrichData?.reason === 'empty_name' || enrichData?.reason === 'placeholder_name') {
            console.log('[AutoEnrich] Skipping - invalid brand name');
          } else if (!enrichData?.wikidata_found) {
            console.log('[AutoEnrich] Brand not found in Wikidata, skipping enrichment');
          }
          
          setProgress({
            status: 'idle',
            message: '',
            step: 0,
            totalSteps: 3
          });
          return; // Exit gracefully
        }

        const qid = enrichData.wikidata_qid;
        console.log('[AutoEnrich] Validated QID:', qid, '- Entity type verified as business');

        // Step 2: QID and description already saved by enrich-brand-wiki
        setProgress({
          status: 'enriching',
          message: 'Brand information validated and saved',
          step: 2,
          totalSteps: 3
        });

        // Step 3: Trigger logo resolution
        setProgress({
          status: 'enriching',
          message: 'Finding brand logo...',
          step: 3,
          totalSteps: 3
        });

        try {
          const { data: logoData } = await supabase.functions.invoke('resolve-brand-logo', {
            body: { brand_id: brandId }
          });
          
          if (logoData?.logo_url) {
            await supabase
              .from('brands')
              .update({ 
                logo_url: logoData.logo_url,
                logo_attribution: logoData.attribution 
              })
              .eq('id', brandId);
          }
        } catch (err) {
          console.warn('[AutoEnrich] Logo fetch failed:', err);
          // Non-critical, continue
        }

        // Step 4: Complete!
        setProgress({
          status: 'complete',
          message: `${brandName} has been enriched!`,
          step: 3,
          totalSteps: 3
        });

        // Invalidate queries to refresh page
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['brand-basic', brandId] });
          queryClient.invalidateQueries({ queryKey: ['brand-company-info', brandId] });
        }, 500);

      } catch (error: any) {
        console.error('[AutoEnrich] Failed:', error);
        setProgress({
          status: 'failed',
          message: `Could not enrich ${brandName}: ${error.message}`,
          step: 0,
          totalSteps: 3
        });
      }
    }

    enrichBrand();
  }, [needsEnrichment, brandId, brandName, progress.status, queryClient]);

  return progress;
}
