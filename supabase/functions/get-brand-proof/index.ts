import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = performance.now();
  
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

    // Fetch BOTH full and deduplicated evidence
    const { data: fullEvidence } = await supabase
      .from('brand_evidence_view')
      .select('*')
      .eq('brand_id', brandId)
      .in('score_component', components)
      .limit(500);

    const { data: dedupEvidence } = await supabase
      .from('brand_evidence_independent')
      .select('*')
      .eq('brand_id', brandId)
      .in('category', components)
      .limit(500);

    // Helper to shape rows
    const toItem = (row: any) => ({
      id: row.evidence_id ?? row.id,
      event_id: row.event_id,
      brand_id: row.brand_id,
      category: row.category ?? row.score_component,
      source_name: row.source_name || 'Unknown Source',
      source_url: row.source_url,
      archive_url: row.archive_url,
      source_date: row.source_date,
      snippet: row.snippet,
      verification: row.verification || 'unverified',
      domain_owner: row.domain_owner || 'Unknown',
      domain_kind: row.domain_kind || 'publisher',
    });

    const fullByCat: Record<string, any[]> = { 
      labor: [], 
      environment: [], 
      politics: [], 
      social: [] 
    };
    (fullEvidence || []).forEach((row: any) => {
      const comp = row.score_component;
      if (fullByCat[comp]) fullByCat[comp].push(toItem(row));
    });

    const dedupByCat: Record<string, any[]> = { 
      labor: [], 
      environment: [], 
      politics: [], 
      social: [] 
    };
    (dedupEvidence || []).forEach((row: any) => {
      if (dedupByCat[row.category]) {
        dedupByCat[row.category].push(toItem(row));
      }
    });

    // Build breakdown summary for each component
    const breakdownSummary = components.map(comp => {
      const catData = breakdown[comp] || {};
      const evidenceFull = fullByCat[comp] || [];
      const evidenceDedup = dedupByCat[comp] || [];

      // Verified/independence calculations use DEDUPED list
      const verifiedDedup = evidenceDedup.filter((e: any) => 
        e.verification === 'official' || e.verification === 'corroborated'
      );
      const verifiedCount = verifiedDedup.length;
      const independentOwners = new Set(verifiedDedup.map((e: any) => e.domain_owner)).size;
      
      const delta = catData.window_delta || 0;
      const hasOfficial = verifiedDedup.some((e: any) => e.verification === 'official');
      
      // Proof gate: large delta needs ≥2 independent owners (or 1 if official present)
      const needsIndependence = Math.abs(delta) > 5 && independentOwners < 2 && !hasOfficial;
      const proofRequired = Math.abs(delta) > 5 && (verifiedCount === 0 || needsIndependence);

      return {
        component: comp,
        base: catData.base || 50,
        base_reason: catData.base_reason || 'Default baseline',
        window_delta: delta,
        value: scoreRow[`score_${comp}` as keyof typeof scoreRow] as number,
        confidence: catData.confidence || 50,
        evidence_count: evidenceDedup.length,
        verified_count: verifiedCount,
        independent_owners: independentOwners,
        proof_required: proofRequired,
        syndicated_hidden_count: Math.max(0, evidenceFull.length - evidenceDedup.length),
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
      evidence: dedupByCat,
      evidence_full: fullByCat,
    };

    const dur = Math.round(performance.now() - t0);
    
    console.log(JSON.stringify({
      level: "info",
      fn: "get-brand-proof",
      brandId: payload.brandId,
      totalScore: payload.totals.totalScore,
      avgConf: payload.totals.confidence,
      cats: payload.breakdown.map(b => ({
        c: b.component,
        ver: b.verified_count,
        ev: b.evidence_count,
        owners: b.independent_owners,
        pr: b.proof_required,
        hid: b.syndicated_hidden_count
      })),
      dur_ms: dur,
      ok: true
    }));

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
    const dur = Math.round(performance.now() - t0);
    console.error(JSON.stringify({
      level: "error",
      fn: "get-brand-proof",
      brandId: new URL(req.url).searchParams.get('brandId') || "none",
      msg: String(e?.message || e),
      dur_ms: dur
    }));
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
