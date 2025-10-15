import { supabase } from "@/integrations/supabase/client";

export interface ProductSearchResult {
  id: string;
  name: string;
  category?: string;
  brand_id?: string;
  barcode: string;
  sim: number;
}

export interface BrandSearchResult {
  id: string;
  name: string;
  parent_company?: string;
  sim: number;
}

export interface CatalogSearchResponse {
  products: ProductSearchResult[];
  brands: BrandSearchResult[];
}

export async function searchCatalog(q: string): Promise<CatalogSearchResponse> {
  if (!q.trim()) return { products: [], brands: [] };
  
  try {
    const { data, error } = await supabase.rpc('search_catalog', {
      p_q: q,
      p_limit: 20
    });
    
    if (error) throw error;
    
    // Type the response - RPC returns jsonb which TypeScript treats as Json type
    const result = data as unknown as { products: ProductSearchResult[]; brands: BrandSearchResult[] };
    
    return {
      products: result?.products || [],
      brands: result?.brands || []
    };
  } catch (error: any) {
    console.error('Search catalog error:', error);
    throw error;
  }
}
