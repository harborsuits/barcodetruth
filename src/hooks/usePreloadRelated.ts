import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PreloadConfig {
  brandId?: string;
  companyId?: string;
  personId?: string;
  investorId?: string;
}

/**
 * Smart pre-loading hook that fetches related entities in the background
 * to make navigation instant when user clicks on related items
 */
export function usePreloadRelated({ brandId, companyId, personId, investorId }: PreloadConfig) {
  useEffect(() => {
    const preloadData = async () => {
      try {
        if (brandId) {
          // Pre-load parent company
          const { data: ownership } = await supabase
            .from('company_ownership')
            .select('parent_company_id, companies!company_ownership_parent_company_id_fkey(id, name, logo_url, brands(id))')
            .eq('child_brand_id', brandId)
            .maybeSingle();

          // Pre-load subsidiaries
          await supabase
            .from('company_ownership')
            .select('child_brand_id, brands!company_ownership_child_brand_id_fkey(id, name, logo_url)')
            .eq('parent_company_id', ownership?.parent_company_id)
            .limit(10);

          // Pre-load key people
          await supabase
            .from('company_people')
            .select('*')
            .eq('company_id', ownership?.parent_company_id)
            .limit(5);

          // Pre-load shareholders
          await supabase
            .from('company_ownership_details')
            .select('*')
            .eq('company_id', ownership?.parent_company_id)
            .order('percent_owned', { ascending: false })
            .limit(5);
        }

        if (companyId) {
          // Pre-load all brands owned by this company
          await supabase
            .from('company_ownership')
            .select('child_brand_id, brands!company_ownership_child_brand_id_fkey(id, name, logo_url)')
            .eq('parent_company_id', companyId)
            .limit(20);

          // Pre-load key people
          await supabase
            .from('company_people')
            .select('*')
            .eq('company_id', companyId);

          // Pre-load shareholders
          await supabase
            .from('company_ownership_details')
            .select('*')
            .eq('company_id', companyId)
            .order('percent_owned', { ascending: false });
        }

        if (personId) {
          // Pre-load all companies this person is associated with
          await supabase
            .from('company_people')
            .select('company_id, companies(id, name, logo_url, brands(id, name, logo_url))')
            .eq('person_qid', personId);
        }

        if (investorId) {
          // Pre-load all companies this investor owns
          await supabase
            .from('company_ownership_details')
            .select('company_id, companies(id, name, logo_url, brands(id, name, logo_url))')
            .eq('owner_name', investorId)
            .order('percent_owned', { ascending: false });
        }
      } catch (error) {
        // Silent fail - this is just pre-loading for performance
        console.debug('Pre-load failed:', error);
      }
    };

    // Run pre-loading in background after a small delay
    const timeoutId = setTimeout(preloadData, 100);
    return () => clearTimeout(timeoutId);
  }, [brandId, companyId, personId, investorId]);
}
