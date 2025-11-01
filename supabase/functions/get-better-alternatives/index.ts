import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ProductAlternative {
  product_id: string;
  barcode: string;
  product_name: string;
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  category: string | null;
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
  avg_score: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { barcode, limit = 5, user_id } = await req.json();

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'barcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // First, get the scanned product's details
    const { data: scannedProduct, error: scanError } = await supabase
      .from('products')
      .select('id, brand_id, category')
      .eq('barcode', barcode)
      .single();

    if (scanError || !scannedProduct) {
      console.warn('[ALTERNATIVES] Product not found for barcode:', barcode, scanError);
      return new Response(
        JSON.stringify({ alternatives: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ALTERNATIVES] Scanned product:', {
      id: scannedProduct.id,
      brand_id: scannedProduct.brand_id,
      category: scannedProduct.category
    });

    // Get user preferences if user_id provided
    let userPreferences = null;
    if (user_id) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('values')
        .eq('user_id', user_id)
        .single();
      
      if (prefs?.values) {
        userPreferences = prefs.values;
      }
    }

    // Query for alternative products in the same category
    const { data: products, error: altError } = await supabase
      .from('products')
      .select('id, barcode, name, category, brand_id')
      .eq('category', scannedProduct.category)
      .neq('brand_id', scannedProduct.brand_id)
      .limit(limit * 3);

    console.log('[ALTERNATIVES] Products query result:', {
      category: scannedProduct.category,
      excluded_brand: scannedProduct.brand_id,
      found_count: products?.length || 0,
      error: altError
    });

    if (altError || !products || products.length === 0) {
      console.warn('[ALTERNATIVES] No alternative products found:', altError);
      return new Response(
        JSON.stringify({ alternatives: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique brand IDs
    const brandIds = [...new Set(products.map(p => p.brand_id))];
    
    // Fetch brand info and scores
    const { data: brands, error: brandError } = await supabase
      .from('brands')
      .select('id, name, logo_url')
      .in('id', brandIds);

    const { data: scores, error: scoreError } = await supabase
      .from('brand_scores')
      .select('brand_id, score_labor, score_environment, score_politics, score_social, score')
      .in('brand_id', brandIds);

    console.log('[ALTERNATIVES] Brand data fetched:', {
      unique_brands: brandIds.length,
      brands_found: brands?.length || 0,
      scores_found: scores?.length || 0,
      brand_error: brandError,
      score_error: scoreError
    });

    if (brandError || scoreError) {
      console.error('[ALTERNATIVES] Error fetching brand data:', brandError || scoreError);
      return new Response(
        JSON.stringify({ alternatives: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create lookups for fast access
    const brandMap = new Map(brands?.map(b => [b.id, b]) || []);
    const scoreMap = new Map(scores?.map(s => [s.brand_id, s]) || []);

    // Transform and calculate match scores
    const transformedAlternatives: ProductAlternative[] = products
      .map((product) => {
        const brand = brandMap.get(product.brand_id);
        const brandScores = scoreMap.get(product.brand_id);
        
        if (!brand || !brandScores) return null;

        // Calculate value match if user preferences exist
        let matchScore = brandScores.score || 50;
        
        if (userPreferences) {
          const { labor = 50, environment = 50, politics = 50, social = 50 } = userPreferences;
          
          // Calculate weighted match based on user values
          matchScore = (
            (brandScores.score_labor * labor / 100) * 0.25 +
            (brandScores.score_environment * environment / 100) * 0.25 +
            (brandScores.score_politics * politics / 100) * 0.25 +
            (brandScores.score_social * social / 100) * 0.25
          );
        }

        return {
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          brand_id: product.brand_id,
          brand_name: brand.name,
          logo_url: brand.logo_url,
          category: product.category,
          score_labor: brandScores.score_labor,
          score_environment: brandScores.score_environment,
          score_politics: brandScores.score_politics,
          score_social: brandScores.score_social,
          avg_score: matchScore
        };
      })
      .filter((alt): alt is ProductAlternative => alt !== null)
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, limit);

    console.log('[ALTERNATIVES] Final result:', {
      total_processed: products.length,
      with_brand_and_scores: transformedAlternatives.length,
      returning: transformedAlternatives.length
    });

    return new Response(
      JSON.stringify({ alternatives: transformedAlternatives }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-better-alternatives:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
