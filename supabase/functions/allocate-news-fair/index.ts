import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrandWithEventCount {
  id: string;
  name: string;
  wikidata_qid: string;
  event_count: number;
  last_ingestion: string | null;
}

function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Fair News Allocation] Starting fair allocation system...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get config from request or use defaults
    const { budget = 100 } = await req.json().catch(() => ({ budget: 100 }));
    
    // STEP 1: Get all brands with event counts
    const { data: brands, error: brandsError } = await supabase
      .rpc('get_brands_with_event_counts');
    
    if (brandsError) {
      console.error('[Fair Allocation] Error fetching brands:', brandsError);
      throw brandsError;
    }

    const typedBrands = brands as BrandWithEventCount[];
    
    // STEP 2: Tier brands by current coverage
    const tiers = {
      empty: typedBrands.filter(b => b.event_count === 0),
      low: typedBrands.filter(b => b.event_count > 0 && b.event_count < 10),
      medium: typedBrands.filter(b => b.event_count >= 10 && b.event_count < 30),
      high: typedBrands.filter(b => b.event_count >= 30)
    };
    
    console.log('[Fair Allocation] Tiers:', {
      empty: tiers.empty.length,
      low: tiers.low.length,
      medium: tiers.medium.length,
      high: tiers.high.length,
      total: typedBrands.length
    });
    
    // STEP 3: Allocate ingestion budget (50% empty, 30% low, 15% medium, 5% high)
    const allocation = {
      empty: Math.floor(budget * 0.5),
      low: Math.floor(budget * 0.3),
      medium: Math.floor(budget * 0.15),
      high: Math.floor(budget * 0.05)
    };
    
    // STEP 4: Select brands from each tier (shuffle for fairness)
    const selectedBrands = [
      ...shuffle(tiers.empty).slice(0, allocation.empty),
      ...shuffle(tiers.low).slice(0, allocation.low),
      ...shuffle(tiers.medium).slice(0, allocation.medium),
      ...shuffle(tiers.high).slice(0, allocation.high)
    ];
    
    console.log('[Fair Allocation] Selected', selectedBrands.length, 'brands for processing');
    console.log('[Fair Allocation] Allocation:', allocation);
    
    // STEP 5: Trigger ingestion for selected brands
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const brand of selectedBrands) {
      try {
        console.log(`[Fair Allocation] Processing: ${brand.name} (${brand.event_count} events)`);
        
        const { error: ingestError } = await supabase.functions.invoke('trigger-brand-ingestion', {
          body: {
            brand_id: brand.id,
            brand_name: brand.name,
            priority: brand.event_count === 0 ? 'high' : 'normal'
          }
        });
        
        if (ingestError) {
          console.error(`[Fair Allocation] Failed for ${brand.name}:`, ingestError);
          results.failed++;
          results.errors.push(`${brand.name}: ${ingestError.message}`);
        } else {
          results.success++;
        }
        
        // Small delay to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error(`[Fair Allocation] Exception for ${brand.name}:`, err);
        results.failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${brand.name}: ${errorMsg}`);
      }
    }
    
    console.log('[Fair Allocation] Complete:', results);
    
    return new Response(
      JSON.stringify({
        success: true,
        tiers: {
          empty: tiers.empty.length,
          low: tiers.low.length,
          medium: tiers.medium.length,
          high: tiers.high.length
        },
        allocation,
        processed: selectedBrands.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Fair Allocation] Fatal error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});