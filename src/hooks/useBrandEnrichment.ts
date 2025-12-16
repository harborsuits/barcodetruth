import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useBrandEnrichment() {
  const { toast } = useToast();

  const fetchSummary = useCallback(async (brandId: string) => {
    try {
      console.log('[useBrandEnrichment] Fetching summary for brand:', brandId);
      const { data, error } = await supabase.functions.invoke('fetch-brand-summary', {
        body: { brand_id: brandId }
      });
      
      console.log('[useBrandEnrichment] Summary response:', data, error);
      if (error) throw error;
      
      if (data?.ok) {
        toast({
          title: 'Summary updated',
          description: 'Brand description has been fetched from Wikipedia.',
        });
        return true;
      } else {
        const reason = data?.reason || 'unknown';
        if (reason === 'no_wikidata') {
          toast({
            title: 'No Wikipedia data',
            description: 'This brand doesn\'t have a Wikidata ID yet.',
            variant: 'destructive'
          });
        } else if (reason === 'manual_override') {
          toast({
            title: 'Manual override',
            description: 'This brand has a manually entered description.',
          });
        }
        return false;
      }
    } catch (error: any) {
      console.error('Error fetching summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch brand summary.',
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  const fetchLogo = useCallback(async (brandId: string) => {
    console.log('🔵 [fetchLogo] Called for:', brandId);
    
    try {
      // Get brand data first to see what we're working with
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id, name, wikidata_qid, website, logo_url')
        .eq('id', brandId)
        .limit(1)
        .maybeSingle();
      
      console.log('🔵 [fetchLogo] Brand data:', brand);
      
      if (brandError) {
        console.error('🔴 [fetchLogo] Error fetching brand:', brandError);
        throw brandError;
      }
      
      if (!brand || (!brand.wikidata_qid && !brand.website)) {
        console.log('🔴 [fetchLogo] Cannot enrich - no wikidata_qid or website');
        toast({
          title: 'Cannot fetch logo',
          description: 'Brand needs either a Wikidata ID or website URL.',
          variant: 'destructive'
        });
        return false;
      }
      
      console.log('🔵 [fetchLogo] Invoking edge function...');
      const start = Date.now();
      
      const { data, error } = await supabase.functions.invoke('resolve-brand-logo', {
        body: { brand_id: brandId }
      });
      
      const duration = Date.now() - start;
      console.log(`🔵 [fetchLogo] Edge function returned in ${duration}ms:`, { data, error });
      
      if (error) {
        console.error('🔴 [fetchLogo] Edge function error:', error);
        toast({
          title: 'Logo enrichment failed',
          description: `${error.message || 'Unknown error'}`,
          variant: 'destructive'
        });
        return false;
      }
      
      if (data?.ok) {
        console.log('✅ [fetchLogo] Success! Logo URL:', data.logo_url);
        toast({
          title: 'Logo updated',
          description: `Found logo from ${data.attribution}`
        });
        return true;
      } else {
        console.log('⚠️ [fetchLogo] No logo found:', data?.reason);
        toast({
          title: 'Logo not found',
          description: data?.reason || 'Could not find a logo for this brand.',
        });
        return false;
      }
      
    } catch (error: any) {
      console.error('🔴 [fetchLogo] Exception:', error);
      toast({
        title: 'Logo enrichment error',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  const enrichBrand = useCallback(async (brandId: string) => {
    try {
      console.log('[useBrandEnrichment] Enriching brand:', brandId);
      const { data, error } = await supabase.functions.invoke('enrich-brand-wiki', {
        body: { brand_id: brandId }
      });
      
      console.log('[useBrandEnrichment] Enrich response:', data, error);
      if (error) throw error;
      
      if (data?.ok) {
        toast({
          title: 'Brand enriched',
          description: 'Brand data updated from Wikidata.',
        });
        return true;
      } else {
        const reason = data?.reason || 'unknown';
        toast({
          title: 'Enrichment failed',
          description: `Could not enrich brand: ${reason}`,
          variant: 'destructive'
        });
        return false;
      }
    } catch (error: any) {
      console.error('Error enriching brand:', error);
      toast({
        title: 'Error',
        description: 'Failed to enrich brand.',
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  return { fetchSummary, fetchLogo, enrichBrand };
}