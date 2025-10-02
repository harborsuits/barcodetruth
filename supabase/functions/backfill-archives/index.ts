import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '100');
    const dryrun = url.searchParams.get('dryrun') === '1';

    console.log(`[backfill-archives] Starting backfill, limit=${limit}, dryrun=${dryrun}`);

    // Find event_sources without archive_url
    const { data: sources, error: fetchErr } = await supabase
      .from('event_sources')
      .select('id, source_url')
      .is('archive_url', null)
      .not('source_url', 'is', null)
      .limit(limit);

    if (fetchErr) throw fetchErr;

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No sources to backfill' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[backfill-archives] Found ${sources.length} sources to archive`);

    let processed = 0;
    let archived = 0;

    if (!dryrun) {
      // Process in batches to avoid overwhelming Wayback
      for (const source of sources) {
        try {
          // Call archive-url edge function
          const { data: archiveResult, error: archiveErr } = await supabase.functions.invoke(
            'archive-url',
            { body: { source_id: source.id, source_url: source.source_url } }
          );

          if (!archiveErr && archiveResult?.success) {
            archived++;
          }
          processed++;

          // Rate limit: wait 1 second between requests
          if (processed < sources.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (e) {
          console.error(`[backfill-archives] Error archiving ${source.id}:`, e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryrun,
        found: sources.length,
        processed,
        archived,
        message: dryrun 
          ? `Would process ${sources.length} sources` 
          : `Archived ${archived}/${processed} sources`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('[backfill-archives] error:', e);
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});