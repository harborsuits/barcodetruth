import { supabase } from "@/integrations/supabase/client";

export interface ProductLookupResult {
  product_id: string;
  gtin: string;
  product_name: string;
  category: string | null;
  brand_sku: string | null;
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  parent_company: string | null;
  description: string | null;
  website: string | null;
  score: number;
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
  last_updated: string | null;
}

export interface AlternativeResult {
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  avg_score: number;
  product_count: number;
}

export interface ScanLookupResponse {
  notFound: boolean;
  product?: ProductLookupResult;
  alternatives?: AlternativeResult[];
}

/**
 * Lookup a product by barcode and log the scan
 * @param rawGtin - The raw barcode string (will be normalized automatically)
 * @param userId - The authenticated user's ID
 * @returns Product info, brand details, scores, and better alternatives
 */
export async function lookupScanAndLog(
  rawGtin: string, 
  userId: string
): Promise<ScanLookupResponse> {
  
  // 1) Product lookup via Edge Function (until types are regenerated)
  const { data: productData, error: lookupError } = await supabase.functions.invoke(
    'get-product-by-barcode',
    { body: { barcode: rawGtin } }
  );

  if (lookupError) {
    console.error('Product lookup error:', lookupError);
    throw lookupError;
  }

  if (!productData || !productData.brand_id) {
    return { notFound: true };
  }

  // 2) Log the scan for analytics/limits
  const { error: logError } = await supabase
    .from('user_scans')
    .insert({
      user_id: userId,
      gtin: productData.gtin,
      brand_id: productData.brand_id,
      scanned_at: new Date().toISOString()
    });

  if (logError) {
    console.warn('Failed to log scan:', logError);
    // Don't throw - logging failure shouldn't break the scan
  }

  // 3) Fetch better alternatives
  const { data: alternatives, error: altsError } = await supabase.functions.invoke(
    'get-better-alternatives',
    { body: { barcode: rawGtin, limit: 3 } }
  );

  if (altsError) {
    console.warn('Failed to fetch alternatives:', altsError);
  }

  return {
    notFound: false,
    product: productData as ProductLookupResult,
    alternatives: alternatives?.alternatives || []
  };
}

/**
 * Quick check if a product exists without logging
 * @param rawGtin - The raw barcode string
 */
export async function checkProductExists(rawGtin: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke(
    'get-product-by-barcode',
    { body: { barcode: rawGtin } }
  );
  
  return !error && !!data && !!data.brand_id;
}
