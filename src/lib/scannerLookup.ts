import { supabase } from "@/integrations/supabase/client";

export interface ProductLookupResult {
  product_id: string;
  barcode: string;
  product_name: string;
  category: string | null;
  brand_sku: string | null;
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  parent_company_id: string | null;
  labor_score: number | null;
  environment_score: number | null;
  politics_score: number | null;
  social_score: number | null;
}

export interface AlternativeResult {
  brand_id: string;
  brand_name: string;
  avg_score: number | null;
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
  
  // 1) Product lookup via Edge Function with explicit typing
  const { data: productData, error: lookupError } = await supabase.functions.invoke<ProductLookupResult>(
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
      barcode: productData.barcode,
      brand_id: productData.brand_id,
      scanned_at: new Date().toISOString()
    });

  if (logError) {
    console.warn('Failed to log scan:', logError);
    // Don't throw - logging failure shouldn't break the scan
  }

  // 3) Fetch better alternatives with explicit typing
  let alternatives: AlternativeResult[] = [];
  try {
    const { data: altWrap, error: altsError } = await supabase.functions.invoke<{ alternatives: AlternativeResult[] }>(
      'get-better-alternatives',
      { body: { barcode: rawGtin, limit: 3 } }
    );
    if (altsError) {
      console.warn('Failed to fetch alternatives:', altsError);
    } else {
      alternatives = altWrap?.alternatives || [];
    }
  } catch (err) {
    console.warn('Alternatives fetch threw:', err);
  }

  return {
    notFound: false,
    product: productData,
    alternatives
  };
}

/**
 * Quick check if a product exists without logging
 * @param rawGtin - The raw barcode string
 */
export async function checkProductExists(rawGtin: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<ProductLookupResult>(
    'get-product-by-barcode',
    { body: { barcode: rawGtin } }
  );
  
  return !error && !!data && !!data.brand_id;
}
