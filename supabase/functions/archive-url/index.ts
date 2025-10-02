import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

type ArchiveResult = { archiveUrl?: string; status: number; note?: string };

async function saveToWayback(url: string, timeoutMs = 8000): Promise<ArchiveResult> {
  try {
    const api = `https://web.archive.org/save/${encodeURIComponent(url)}`;
    const res = await fetch(api, { 
      method: 'GET', 
      redirect: 'manual', 
      signal: AbortSignal.timeout(timeoutMs) 
    });
    
    const archive = res.headers.get('Content-Location') || res.headers.get('X-Archive-Orig-Location');
    const archiveUrl = archive
      ? `https://web.archive.org${archive}`
      : res.headers.get('Memento-Datetime')
        ? `https://web.archive.org/web/*/${url}`
        : undefined;
    
    return { archiveUrl, status: res.status };
  } catch (e: any) {
    return { status: 0, note: e?.message || 'wayback error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { source_id, source_url } = await req.json();
    
    if (!source_id || !source_url) {
      return new Response(
        JSON.stringify({ error: 'source_id and source_url required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[archive-url] Archiving source ${source_id}: ${source_url}`);

    const { archiveUrl, status, note } = await saveToWayback(source_url);
    
    if (archiveUrl) {
      const { error: updateErr } = await supabase
        .from('event_sources')
        .update({ archive_url: archiveUrl })
        .eq('id', source_id);

      if (updateErr) {
        console.error('[archive-url] Update failed:', updateErr);
        return new Response(
          JSON.stringify({ error: 'Failed to update archive URL' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[archive-url] Archived: ${archiveUrl}`);
      return new Response(
        JSON.stringify({ success: true, archiveUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.warn(`[archive-url] Failed to archive (status ${status}): ${note || 'no archive URL returned'}`);
      return new Response(
        JSON.stringify({ success: false, status, note }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (e: any) {
    console.error('[archive-url] error:', e);
    return new Response(
      JSON.stringify({ error: e?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
