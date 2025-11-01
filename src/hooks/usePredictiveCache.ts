import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiresAt: number;
}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Predictive caching hook that anticipates user's next actions
 * and pre-loads likely data into memory cache
 */
export function usePredictiveCache(currentBrandId?: string) {
  useEffect(() => {
    const predictAndCache = async () => {
      if (!currentBrandId) return;

      try {
        // Get current brand data
        const { data: brand } = await supabase
          .from('brands')
          .select(`
            name,
            company_ownership!company_ownership_child_brand_id_fkey(
              parent_company_id,
              companies!company_ownership_parent_company_id_fkey(
                id,
                name
              )
            )
          `)
          .eq('id', currentBrandId)
          .single();

        if (!brand?.company_ownership?.[0]) return;

        const parentCompanyId = brand.company_ownership[0].parent_company_id;

        // Predict user will explore siblings
        const { data: siblings } = await supabase
          .from('company_ownership')
          .select('child_brand_id, brands!company_ownership_child_brand_id_fkey(id, name, logo_url, description)')
          .eq('parent_company_id', parentCompanyId)
          .neq('child_brand_id', currentBrandId)
          .limit(10);

        // Cache sibling data
        siblings?.forEach((sibling) => {
          if (sibling.brands) {
            cacheData(`brand:${sibling.brands.id}`, sibling.brands);
          }
        });

        // Predict user will explore parent company
        const { data: parentData } = await supabase
          .from('companies')
          .select('*, brands(id, name, logo_url, description)')
          .eq('id', parentCompanyId)
          .single();

        if (parentData) {
          cacheData(`company:${parentCompanyId}`, parentData);
        }

        // Predict user will check key people
        const { data: keyPeople } = await supabase
          .from('company_people')
          .select('*')
          .eq('company_id', parentCompanyId)
          .limit(10);

        if (keyPeople) {
          cacheData(`key-people:${parentCompanyId}`, keyPeople);
        }

        // Predict user will check shareholders
        const { data: shareholders } = await supabase
          .from('company_ownership_details')
          .select('*')
          .eq('company_id', parentCompanyId)
          .order('percent_owned', { ascending: false })
          .limit(10);

        if (shareholders) {
          cacheData(`shareholders:${parentCompanyId}`, shareholders);
        }
      } catch (error) {
        console.debug('Predictive cache failed:', error);
      }
    };

    const timeoutId = setTimeout(predictAndCache, 200);
    return () => clearTimeout(timeoutId);
  }, [currentBrandId]);
}

function cacheData(key: string, data: any) {
  const now = Date.now();
  cache.set(key, {
    key,
    data,
    timestamp: now,
    expiresAt: now + CACHE_DURATION
  });
}

export function getCachedData(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

export function clearCache() {
  cache.clear();
}
