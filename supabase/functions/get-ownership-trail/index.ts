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

    // Get upstream ownership (parents) - CONTROL RELATIONSHIPS ONLY
    const upstream: Array<{ brand: BrandNode; relationship: string; confidence: number; sources: Array<{name: string; url: string | null}> }> = [];
    const seenIds = new Set<string>([brandId]); // Loop detection
    const MAX_DEPTH = 3;
    let parentIds: string[] = [];
    
    // Start by checking company_ownership for parent companies
    const { data: parentOwnership } = await supabase
      .from('company_ownership')
      .select('parent_company_id, relationship, confidence, source, companies!parent_company_id(id, name, wikidata_qid)')
      .eq('child_brand_id', brandId)
      .in('relationship', ['parent', 'subsidiary', 'parent_organization'])
      .gte('confidence', 0.7)
      .order('confidence', { ascending: false })
      .limit(1);
    
    if (parentOwnership && parentOwnership.length > 0) {
      const parentCompany = parentOwnership[0].companies as any;
      
      // Find the brand record for this parent company
      const { data: parentBrand } = await supabase
        .from('brands')
        .select('id, name, wikidata_qid, website')
        .eq('wikidata_qid', parentCompany.wikidata_qid)
        .maybeSingle();
      
      if (parentBrand) {
        upstream.push({
          brand: parentBrand,
          relationship: parentOwnership[0].relationship,
          confidence: parentOwnership[0].confidence || 75,
          sources: [{ name: parentOwnership[0].source, url: null }]
        });
        parentIds.push(parentBrand.id);
        seenIds.add(parentBrand.id);
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

    // Log outcome for monitoring
    const stoppedReason = upstream.length === 0 ? 'no_parent' : 'complete';
    
    const topParent = upstream.length > 0 ? upstream[upstream.length - 1].brand : null;
    const sanitizedBrandName = brand.name.replace(/[^\w\s-]/g, '').substring(0, 50);
    
    console.log(
      `[Ownership Trail] brand=${brandId} (${sanitizedBrandName}), chain_len=${upstream.length}, stopped=${stoppedReason}` +
      (topParent ? `, top_parent=${topParent.id} (${topParent.name.replace(/[^\w\s-]/g, '').substring(0, 30)})` : '')
    );

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
