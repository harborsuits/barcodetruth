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

    // Get upstream ownership (parents) with loop detection and depth limit
    const upstream: Array<{ brand: BrandNode; relationship: string; confidence: number; sources: Array<{name: string; url: string | null}> }> = [];
    const seenIds = new Set<string>([brandId]); // Loop detection
    const MAX_DEPTH = 3;
    let parentIds: string[] = [];
    
    let currentBrandId = brandId;
    let depth = 0;
    
    // Walk up the ownership chain
    while (currentBrandId && depth < MAX_DEPTH) {
      const { data: edges } = await supabase
        .from('brand_ownerships')
        .select('brand_id, parent_brand_id, relationship_type, source, source_url, confidence')
        .eq('brand_id', currentBrandId)
        .order('confidence', { ascending: false })
        .limit(1); // Take highest confidence parent
      
      if (!edges || edges.length === 0) break;
      
      const edge = edges[0];
      
      // Loop detection
      if (seenIds.has(edge.parent_brand_id)) {
        console.warn('Loop detected in ownership chain:', edge.parent_brand_id);
        break;
      }
      seenIds.add(edge.parent_brand_id);
      
      // Get parent brand details
      const { data: parentBrand } = await supabase
        .from('brands')
        .select('id, name, wikidata_qid, website')
        .eq('id', edge.parent_brand_id)
        .single();
      
      if (parentBrand) {
        upstream.push({
          brand: parentBrand,
          relationship: edge.relationship_type,
          confidence: edge.confidence || 75,
          sources: [{ name: edge.source, url: edge.source_url }]
        });
        parentIds.push(parentBrand.id);
        currentBrandId = parentBrand.id; // Move up the chain
      } else {
        break;
      }
      
      depth++;
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

    // Log outcome for monitoring
    const stoppedReason = upstream.length === 0 ? 'no_parent' 
      : depth === MAX_DEPTH ? 'max_depth' 
      : seenIds.size > upstream.length + 1 ? 'loop' 
      : 'complete';
    
    console.log(`[Ownership Trail] brand=${brandId}, depth=${upstream.length}, stopped=${stoppedReason}`);

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
