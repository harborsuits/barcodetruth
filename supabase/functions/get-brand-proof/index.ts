import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const brandId = url.searchParams.get('brandId');
    
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brandId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Get brand info
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get latest score breakdown
    const { data: scoreRow, error: scoreError } = await supabase
      .from('brand_scores')
      .select('breakdown, last_updated, score_labor, score_environment, score_politics, score_social')
      .eq('brand_id', brandId)
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scoreError || !scoreRow) {
      return new Response(
        JSON.stringify({ error: 'No score data available' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const breakdown = (scoreRow.breakdown as any) || {};
    const components = ['labor', 'environment', 'politics', 'social'];
    
    // Calculate total score (weighted average)
    const totalScore = Math.round(
      (scoreRow.score_labor + scoreRow.score_environment + scoreRow.score_politics + scoreRow.score_social) / 4
    );

    // Fetch evidence per component
    const { data: rawEvidence } = await supabase
      .from('brand_evidence_view')
      .select('*')
      .eq('brand_id', brandId)
      .in('score_component', components)
      .limit(100);

    const evidenceByCat: Record<string, any[]> = { 
      labor: [], 
      environment: [], 
      politics: [], 
      social: [] 
    };

    (rawEvidence || []).forEach((row: any) => {
      const item = {
        id: row.evidence_id,
        event_id: row.event_id,
        brand_id: row.brand_id,
        category: row.category,
        score_component: row.score_component,
        source_name: row.source_name || 'Unknown Source',
        source_url: row.source_url,
        archive_url: row.archive_url,
        source_date: row.source_date,
        snippet: row.snippet,
        verification: row.verification || 'unverified',
      };
      if (evidenceByCat[row.score_component]) {
        evidenceByCat[row.score_component].push(item);
      }
    });

    // Build breakdown summary for each component
    const breakdownSummary = components.map(comp => {
      const catData = breakdown[comp] || {};
      const evidence = evidenceByCat[comp] || [];
      const verifiedCount = evidence.filter((e: any) => 
        e.verification === 'official' || e.verification === 'corroborated'
      ).length;
      
      const delta = catData.windowDelta || 0;
      const proofRequired = Math.abs(delta) > 5 && verifiedCount === 0;

      return {
        component: comp,
        base: catData.base || 50,
        base_reason: catData.baseReason || 'Default baseline',
        window_delta: delta,
        value: scoreRow[`score_${comp}` as keyof typeof scoreRow] as number,
        confidence: catData.confidence || 50,
        evidence_count: evidence.length,
        verified_count: verifiedCount,
        proof_required: proofRequired,
      };
    });

    const avgConf = Math.round(
      breakdownSummary.reduce((s, b) => s + b.confidence, 0) / breakdownSummary.length
    );

    const payload = {
      brandId: brand.id,
      brandName: brand.name,
      updatedAt: scoreRow.last_updated,
      totals: {
        totalScore,
        confidence: avgConf,
      },
      breakdown: breakdownSummary,
      evidence: evidenceByCat,
    };

    console.info('[proof:view]', {
      brandId: payload.brandId,
      totalScore: payload.totals.totalScore,
      avgConfidence: payload.totals.confidence,
      cats: payload.breakdown.map(b => ({
        c: b.component,
        ver: b.verified_count,
        ev: b.evidence_count,
        pr: b.proof_required,
      })),
    });

    return new Response(
      JSON.stringify(payload),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        } 
      }
    );

  } catch (e: any) {
    console.error('[get-brand-proof] error:', e);
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
