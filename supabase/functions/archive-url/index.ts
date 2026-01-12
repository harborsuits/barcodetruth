import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

// Safe error messages - never expose internal details to clients
const SAFE_ERRORS = {
  invalid_input: 'Invalid request data',
  invalid_url: 'Invalid URL format',
  archive_failed: 'Archival failed',
  update_failed: 'Failed to update record',
  internal_error: 'An unexpected error occurred',
};

type ArchiveResult = { archiveUrl?: string; status: number; note?: string };

// Input validation helpers
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isValidHttpsUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

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
  } catch (e) {
    // Log detailed error server-side only
    console.error('[archive-url] Wayback error:', e);
    return { status: 0, note: 'Archive service error' };
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

    // Parse and validate input
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: SAFE_ERRORS.invalid_input }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!requestBody || typeof requestBody !== 'object') {
      return new Response(
        JSON.stringify({ error: SAFE_ERRORS.invalid_input }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { source_id, source_url } = requestBody as { source_id?: unknown; source_url?: unknown };
    
    // Validate source_id is a valid UUID
    if (!source_id || typeof source_id !== 'string' || !isValidUUID(source_id)) {
      return new Response(
        JSON.stringify({ error: SAFE_ERRORS.invalid_input }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate source_url is a valid HTTP/HTTPS URL
    if (!source_url || typeof source_url !== 'string' || !isValidHttpsUrl(source_url)) {
      return new Response(
        JSON.stringify({ error: SAFE_ERRORS.invalid_url }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Additional URL safety checks
    const parsedUrl = new URL(source_url);
    if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname.startsWith('127.') || parsedUrl.hostname.startsWith('192.168.')) {
      return new Response(
        JSON.stringify({ error: SAFE_ERRORS.invalid_url }),
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
        console.error('[archive-url] Update error:', updateErr);
        return new Response(
          JSON.stringify({ error: SAFE_ERRORS.update_failed }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[archive-url] Archived: ${archiveUrl}`);
      return new Response(
        JSON.stringify({ success: true, archiveUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.warn(`[archive-url] Archive failed (status ${status}): ${note || 'no archive URL'}`);
      return new Response(
        JSON.stringify({ success: false, error: SAFE_ERRORS.archive_failed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    // Log full error server-side, return generic message to client
    console.error('[archive-url] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: SAFE_ERRORS.internal_error }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
