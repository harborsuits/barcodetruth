import { supabase } from "@/integrations/supabase/client";

export interface BrandSearchResult {
  id: string;
  name: string;
  parent_company?: string;
  confidence?: number;
  match_type?: 'alias' | 'exact' | 'fuzzy';
  matched_alias?: string;
  similarity?: number;
}

export interface SearchResponse {
  data: BrandSearchResult[];
  suggestions?: Array<{ id: string; name: string; confidence: number }>;
}

export async function searchBrands(q: string): Promise<SearchResponse> {
  if (!q.trim()) return { data: [] };
  
  try {
    const { data, error } = await supabase.functions.invoke('search-brands', {
      body: { q }
    });
    
    if (error) throw error;
    return {
      data: data?.data || [],
      suggestions: data?.suggestions
    };
  } catch (error: any) {
    if (error?.message?.includes('rate_limited')) {
      throw new Error('Too many requests. Please wait a moment.');
    }
    throw error;
  }
}
