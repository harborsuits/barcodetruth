import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PurgeRequest {
  dryRun?: boolean;
  brandId?: string;
  hardDelete?: boolean;
  maxRows?: number;
  scoreBelow?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PurgeRequest = await req.json().catch(() => ({}));
    const {
      dryRun = true,
      brandId,
      hardDelete = false,
      maxRows = 1000,
      scoreBelow = 0.5,
    } = body;

    // Validate inputs
    if (maxRows < 1 || maxRows > 5000) {
      return new Response(
        JSON.stringify({ ok: false, error: 'maxRows must be between 1 and 5000' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (scoreBelow < 0 || scoreBelow > 1) {
      return new Response(
        JSON.stringify({ ok: false, error: 'scoreBelow must be between 0 and 1' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load brand monitoring configs to apply brand-specific exclude patterns
    const brandMap = new Map<string, string[]>();
    
    if (brandId) {
      const { data: brand } = await supabase
        .from('brands')
        .select('id, monitoring_config')
        .eq('id', brandId)
        .single();
      
      if (brand) {
        brandMap.set(brand.id, (brand.monitoring_config?.exclude_regex ?? []) as string[]);
      }
    } else {
      const { data: brands } = await supabase
        .from('brands')
        .select('id, monitoring_config');
      
      for (const b of brands ?? []) {
        brandMap.set(b.id, (b.monitoring_config?.exclude_regex ?? []) as string[]);
      }
    }

    // Fetch candidate events for purging
    let query = supabase
      .from('brand_events')
      .select('event_id, brand_id, title, description, source_url, relevance_score, relevance_reason, is_irrelevant')
      .or(`relevance_score.lte.${scoreBelow},is_irrelevant.eq.false`)
      .limit(maxRows)
      .order('event_date', { ascending: false });

    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('Error fetching events:', error);
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates: Array<{ event_id: string; is_irrelevant: boolean; relevance_reason: string }> = [];
    const deletes: string[] = [];

    for (const row of rows ?? []) {
      const patterns = brandMap.get(row.brand_id) ?? [];
      const text = `${row.title ?? ''} ${row.description ?? ''}`;
      
      // Check if any brand-specific exclude pattern matches
      const excludeMatch = patterns.some((p) => {
        try {
          const re = new RegExp(p, 'i');
          return re.test(text);
        } catch (e) {
          console.warn(`Invalid regex pattern: ${p}`, e);
          return false;
        }
      });

      const shouldPurge = excludeMatch || (row.relevance_score ?? 1) <= scoreBelow;

      if (shouldPurge) {
        if (dryRun) continue;
        
        if (hardDelete) {
          deletes.push(row.event_id);
        } else {
          updates.push({
            event_id: row.event_id,
            is_irrelevant: true,
            relevance_reason: `${row.relevance_reason ?? ''} | purged_score:${row.relevance_score}`,
          });
        }
      }
    }

    // Execute updates/deletes
    if (!dryRun) {
      if (updates.length) {
        const { error: updateError } = await supabase
          .from('brand_events')
          .upsert(updates, { onConflict: 'event_id' });
        
        if (updateError) {
          console.error('Error updating events:', updateError);
          return new Response(
            JSON.stringify({ ok: false, error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (deletes.length) {
        // Delete event_sources first (cascade)
        await supabase
          .from('event_sources')
          .delete()
          .in('event_id', deletes);

        const { error: deleteError } = await supabase
          .from('brand_events')
          .delete()
          .in('event_id', deletes);

        if (deleteError) {
          console.error('Error deleting events:', deleteError);
          return new Response(
            JSON.stringify({ ok: false, error: deleteError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const result = {
      ok: true,
      reviewed: rows?.length ?? 0,
      wouldPurge: dryRun ? (updates.length + deletes.length) : undefined,
      updated: dryRun ? 0 : updates.length,
      deleted: dryRun ? 0 : deletes.length,
      brandFiltered: !!brandId,
      threshold: scoreBelow,
      hardDelete,
      dryRun,
    };

    console.log('Purge complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Purge error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
