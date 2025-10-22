import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CategoryOutlook {
  category: string;
  n: number;
  mean_score: number;
  sd: number;
  total_weight: number;
  histogram: {
    s1: number;
    s2: number;
    s3: number;
    s4: number;
    s5: number;
  };
  confidence: 'low' | 'medium' | 'high' | 'none';
  display_score: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Support both GET (query params) and POST (JSON body)
    let brand_id: string | null;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      brand_id = url.searchParams.get('brand_id');
    } else {
      const body = await req.json();
      brand_id = body.brand_id;
    }

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: 'brand_id parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch aggregated outlook data
    const { data, error } = await supabase
      .from('brand_category_outlook')
      .select('*')
      .eq('brand_id', brand_id);

    if (error) {
      throw error;
    }

    // Process each category
    const categories: CategoryOutlook[] = (data || []).map((row: any) => {
      const n = row.n || 0;
      const mean_score = row.mean_score || 3.0;
      
      // Bayesian shrinkage toward neutral (3.0) to stabilize small samples
      const k = 20; // prior strength
      const posterior = (mean_score * n + 3.0 * k) / (n + k);

      // Determine confidence level
      let confidence: 'low' | 'medium' | 'high' | 'none' = 'none';
      if (n >= 100) confidence = 'high';
      else if (n >= 30) confidence = 'medium';
      else if (n >= 10) confidence = 'low';

      return {
        category: row.category,
        n,
        mean_score,
        sd: row.sd || 0,
        total_weight: row.total_weight || 0,
        histogram: {
          s1: row.s1 || 0,
          s2: row.s2 || 0,
          s3: row.s3 || 0,
          s4: row.s4 || 0,
          s5: row.s5 || 0,
        },
        confidence,
        display_score: Math.round(posterior * 100) / 100,
      };
    });

    // Ensure all categories are present (even with n=0)
    const allCategories = ['labor', 'environment', 'politics', 'social'];
    const result = allCategories.map(cat => {
      const existing = categories.find(c => c.category === cat);
      return existing || {
        category: cat,
        n: 0,
        mean_score: 3.0,
        sd: 0,
        total_weight: 0,
        histogram: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 },
        confidence: 'none',
        display_score: 3.0,
      };
    });

    return new Response(
      JSON.stringify({ brand_id, categories: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in community-outlook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
