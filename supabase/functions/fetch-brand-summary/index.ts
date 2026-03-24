import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Disambiguation phrases that indicate the wrong Wikipedia article
const DISAMBIGUATION_SIGNALS = [
  'may refer to',
  'can refer to',
  'may also refer to',
  'is a disambiguation',
  'for other uses',
  'for the ',
  // Generic definitions that aren't about the brand
  'in computer graphics',
  'in folklore',
  'mythological',
  'mythical',
  'a sprite is a',
  'in mythology',
  'is a genus',
  'is a species',
  'is a village',
  'is a town in',
  'is a city in',
  'is a river',
  'is a mountain',
  'is a 19',       // "is a 1994 film"
  'is a 20',       // "is a 2003 album"
  'is a fictional',
  'is a character',
  'is a song',
  'is an album',
  'is a film',
  'is a novel',
  'is a video game',
  'is a television',
  'is a tv ',
];

// Commercial entity signals that confirm we have the right article
const COMMERCIAL_SIGNALS = [
  'company',
  'corporation',
  'brand',
  'manufacturer',
  'produced by',
  'subsidiary',
  'headquartered',
  'founded in',
  'incorporated',
  'publicly traded',
  'conglomerate',
  'retailer',
  'beverage',
  'food product',
  'soft drink',
  'consumer',
  'marketed',
  'sells',
  'product line',
  'trademark',
  'owned by',
  'parent company',
  'the coca-cola company',
  'pepsico',
  'nestlé',
  'unilever',
  'procter',
];

function isDisambiguationText(text: string): boolean {
  const lower = text.toLowerCase();
  return DISAMBIGUATION_SIGNALS.some(signal => lower.includes(signal));
}

function hasCommercialSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return COMMERCIAL_SIGNALS.some(signal => lower.includes(signal));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { brand_id } = await req.json();
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!brand_id || !uuidRegex.test(brand_id)) {
      console.log(JSON.stringify({ action: 'fetch-brand-summary', ok: false, reason: 'invalid_brand_id', duration_ms: Date.now() - startTime }));
      return new Response(
        JSON.stringify({ error: 'valid brand_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid, description_source')
      .eq('id', brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (brand.description_source === 'manual') {
      console.log(JSON.stringify({ action: 'fetch-brand-summary', brand_id, ok: false, reason: 'manual_override', duration_ms: Date.now() - startTime }));
      return new Response(
        JSON.stringify({ ok: false, reason: 'manual_override' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search Wikipedia with multiple query variants to find the commercial entity
    const searchVariants = [
      `${brand.name} (brand)`,
      `${brand.name} (drink)`,
      `${brand.name} (company)`,
      `${brand.name} brand`,
      `${brand.name} company`,
      brand.name,
    ];

    let bestDescription: string | null = null;
    let bestWikiUrl: string | null = null;

    for (const searchTerm of searchVariants) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      try {
        // Search for multiple results, not just 1
        const searchResp = await fetch(
          `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(searchTerm)}&limit=5&format=json`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        
        if (!searchResp.ok) continue;

        const searchResults = await searchResp.json();
        const titles = searchResults[1] as string[];
        const urls = searchResults[3] as string[];

        if (!titles || titles.length === 0) continue;

        // Check each result for commercial relevance
        for (let i = 0; i < titles.length; i++) {
          const pageTitle = titles[i];
          
          // Skip disambiguation pages explicitly
          if (pageTitle.toLowerCase().includes('disambiguation')) continue;

          const wikiController = new AbortController();
          const wikiTimeout = setTimeout(() => wikiController.abort(), 8000);
          
          const wikiResp = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
            { signal: wikiController.signal }
          );
          clearTimeout(wikiTimeout);

          if (!wikiResp.ok) continue;

          const wikiData = await wikiResp.json();
          
          // Skip disambiguation pages
          if (wikiData.type === 'disambiguation') continue;
          
          const extract = wikiData.extract || '';
          
          // Reject if it reads like disambiguation or non-commercial content
          if (isDisambiguationText(extract)) {
            console.log(`[fetch-brand-summary] Rejected "${pageTitle}" - disambiguation/non-commercial text`);
            continue;
          }

          // Accept if it has commercial signals
          if (hasCommercialSignal(extract)) {
            bestDescription = extract;
            bestWikiUrl = urls?.[i] || null;
            console.log(`[fetch-brand-summary] Accepted "${pageTitle}" - commercial entity confirmed`);
            break;
          }
          
          // If no commercial signal but also not disambiguation, save as fallback
          if (!bestDescription && extract.length > 80) {
            bestDescription = extract;
            bestWikiUrl = urls?.[i] || null;
          }
        }
        
        // Stop searching variants if we found a good match
        if (bestDescription && hasCommercialSignal(bestDescription)) break;
        
      } catch (fetchError) {
        clearTimeout(timeout);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') continue;
        console.warn('[fetch-brand-summary] Search variant failed:', searchTerm, fetchError);
      }
    }

    if (!bestDescription) {
      console.log(JSON.stringify({ action: 'fetch-brand-summary', brand_id, ok: false, reason: 'no_valid_description', duration_ms: Date.now() - startTime }));
      return new Response(
        JSON.stringify({ ok: false, reason: 'no_valid_description' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize
    let description = bestDescription
      .replace(/\[\d+\]/g, '')
      .replace(/\([^)]*citation needed[^)]*\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (description.length > 1200) {
      description = description.substring(0, 1197) + '...';
    }

    // Final safety check — reject if the cleaned description still looks like disambiguation
    if (isDisambiguationText(description)) {
      console.log(JSON.stringify({ action: 'fetch-brand-summary', brand_id, ok: false, reason: 'disambiguation_leak', duration_ms: Date.now() - startTime }));
      return new Response(
        JSON.stringify({ ok: false, reason: 'disambiguation_leak' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: updateError } = await supabase
      .from('brands')
      .update({
        description,
        description_source: 'wikipedia',
        description_lang: 'en'
      })
      .eq('id', brand_id);

    if (updateError) {
      console.error('Failed to update brand:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update brand' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(JSON.stringify({ action: 'fetch-brand-summary', brand_id, ok: true, source: 'wikipedia', duration_ms: Date.now() - startTime }));

    return new Response(
      JSON.stringify({ ok: true, description }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('fetch-brand-summary error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
