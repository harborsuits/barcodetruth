import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OwnershipEdge {
  brand_id: string;
  parent_brand_id: string;
  relationship_type: string;
  source: string;
  source_url: string | null;
  confidence: number;
}

interface BrandNode {
  id: string;
  name: string;
  wikidata_qid?: string;
  website?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const brandId = url.searchParams.get('brand_id');

    if (!brandId) {
      return new Response(JSON.stringify({ error: 'brand_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get brand info
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid, website')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get upstream ownership (parents) with loop detection
    const { data: upstreamEdges } = await supabase
      .from('brand_ownerships')
      .select('brand_id, parent_brand_id, relationship_type, source, source_url, confidence')
      .eq('brand_id', brandId)
      .order('confidence', { ascending: false });

    const upstream: Array<{ brand: BrandNode; relationship: string; confidence: number; sources: Array<{name: string; url: string | null}> }> = [];
    let parentIds: string[] = [];
    const seenIds = new Set<string>([brandId]); // Loop detection

    if (upstreamEdges && upstreamEdges.length > 0) {
      parentIds = upstreamEdges.map(e => e.parent_brand_id).filter(id => {
        if (seenIds.has(id)) {
          console.warn('Loop detected in ownership chain:', id);
          return false;
        }
        seenIds.add(id);
        return true;
      });
      
      if (parentIds.length === 0) {
        console.warn('All parent edges would create loops');
      } else {
        const { data: parentBrands } = await supabase
          .from('brands')
          .select('id, name, wikidata_qid, website')
          .in('id', parentIds);

        for (const edge of upstreamEdges) {
          if (!parentIds.includes(edge.parent_brand_id)) continue;
          const parentBrand = parentBrands?.find(b => b.id === edge.parent_brand_id);
          if (parentBrand) {
            upstream.push({
              brand: parentBrand,
              relationship: edge.relationship_type,
              confidence: edge.confidence || 75,
              sources: [{ name: edge.source, url: edge.source_url }]
            });
          }
        }
      }
    }

    // Get downstream siblings (brands with same parent)
    const downstreamSiblings: BrandNode[] = [];
    if (parentIds.length > 0) {
      const { data: siblingEdges } = await supabase
        .from('brand_ownerships')
        .select('brand_id')
        .in('parent_brand_id', parentIds)
        .neq('brand_id', brandId);

      if (siblingEdges && siblingEdges.length > 0) {
        const siblingIds = [...new Set(siblingEdges.map(e => e.brand_id))];
        const { data: siblingBrands } = await supabase
          .from('brands')
          .select('id, name, wikidata_qid, website')
          .in('id', siblingIds)
          .limit(10);

        if (siblingBrands) {
          downstreamSiblings.push(...siblingBrands);
        }
      }
    }

    // Calculate overall confidence
    const avgConfidence = upstream.length > 0
      ? Math.round(upstream.reduce((sum, u) => sum + u.confidence, 0) / upstream.length)
      : 0;

    const response = {
      brand,
      upstream,
      downstream_siblings: downstreamSiblings,
      confidence: avgConfidence,
      sources: upstream.flatMap(u => u.sources).slice(0, 3)
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-ownership-trail:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
