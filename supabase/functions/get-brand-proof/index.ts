import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = performance.now();
  
  try {
    const url = new URL(req.url);
    let brandId = url.searchParams.get('brandId');
    let userId: string | null = null;
    
    // If not in query params, check POST body
    if (!brandId && req.method === 'POST') {
      try {
        const body = await req.json();
        brandId = body.brandId;
        userId = body.userId; // Get userId from body
      } catch {
        // Invalid JSON, continue
      }
    }
    
    // Try to get user from Authorization header if not in body
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const supabaseTemp = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const { data: { user } } = await supabaseTemp.auth.getUser(token);
          userId = user?.id || null;
        } catch {
          // No valid user, continue without personalization
        }
      }
    }
    
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brandId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { fetch } }
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

    // Get latest score breakdown + recompute timestamp
    const { data: scoreRow, error: scoreError } = await supabase
      .from('brand_scores')
      .select('breakdown, last_updated, recomputed_at, score_labor, score_environment, score_politics, score_social')
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
    
    // Get user preferences if userId available
    let userWeights: Record<string, number> = {
      labor: 1.0,
      environment: 1.0,
      politics: 1.0,
      social: 1.0
    };
    
    if (userId) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('w_labor, w_environment, w_politics, w_social')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (prefs) {
        userWeights = {
          labor: prefs.w_labor || 1.0,
          environment: prefs.w_environment || 1.0,
          politics: prefs.w_politics || 1.0,
          social: prefs.w_social || 1.0
        };
      }
    }
    
    // Calculate weighted scores per component
    const componentScores: Record<string, number> = {
      labor: scoreRow.score_labor,
      environment: scoreRow.score_environment,
      politics: scoreRow.score_politics,
      social: scoreRow.score_social
    };
    
    // Apply user weights to calculate personalized total
    const weightedSum = components.reduce((sum, comp) => 
      sum + (componentScores[comp] * userWeights[comp]), 0
    );
    const totalWeight = Object.values(userWeights).reduce((a, b) => a + b, 0);
    const totalScore = Math.round(weightedSum / totalWeight);

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

    // Get last ingested timestamp
    const { data: lastEvent } = await supabase
      .from('brand_events')
      .select('created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Helper to shape rows
    const toItem = (row: any) => ({
      id: row.evidence_id ?? row.id,
      event_id: row.event_id,
      brand_id: row.brand_id,
      category: row.category ?? row.score_component,
      title: row.title || 'Untitled event',
      occurred_at: row.occurred_at,
      source_name: row.source_name || 'Unknown Source',
      source_url: row.source_url,
      canonical_url: row.canonical_url,
      archive_url: row.archive_url,
      source_date: row.source_date,
      snippet: row.snippet,
      verification: row.verification || 'unverified',
      domain_owner: row.domain_owner || 'Unknown',
      domain_kind: row.domain_kind || 'publisher',
      link_kind: row.link_kind,
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
      
      // Apply user weight to adjust perceived importance
      const rawBase = catData.base || 50;
      const userWeight = userWeights[comp] || 1.0;
      
      // User weight affects how much this category matters in the display
      // Higher weight = more emphasis on deviations from neutral (50)
      const personalizedBase = userWeight !== 1.0 
        ? Math.round(50 + ((rawBase - 50) * userWeight))
        : rawBase;

      return {
        component: comp,
        base: personalizedBase,
        base_reason: userWeight !== 1.0 
          ? `${catData.base_reason || 'Default baseline'} (adjusted for your preferences)`
          : (catData.base_reason || 'Default baseline'),
        window_delta: delta,
        value: scoreRow[`score_${comp}` as keyof typeof scoreRow] as number,
        confidence: catData.confidence || 50,
        evidence_count: evidenceDedup.length,
        verified_count: verifiedCount,
        independent_owners: independentOwners,
        proof_required: proofRequired,
        syndicated_hidden_count: Math.max(0, evidenceFull.length - evidenceDedup.length),
        user_weight: userWeight
      };
    });

    const avgConf = Math.round(
      breakdownSummary.reduce((s, b) => s + b.confidence, 0) / breakdownSummary.length
    );

    const payload = {
      brandId: brand.id,
      brandName: brand.name,
      updatedAt: scoreRow.last_updated,
      lastRecomputeAt: scoreRow.recomputed_at || scoreRow.last_updated,
      lastIngestedAt: lastEvent?.created_at || null,
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
