// Backfill/reclassify existing events with low or no category confidence
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReclassifyRequest {
  batch_size?: number;
  min_confidence?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { batch_size = 100, min_confidence = 0.5 } = await req.json() as ReclassifyRequest;

    console.log(`[reclassify] Fetching up to ${batch_size} events with confidence < ${min_confidence}`);

    // Fetch events that need reclassification
    const { data: events, error: fetchError } = await supabase
      .from("brand_events")
      .select("event_id, brand_id, title, description, source_url")
      .or(`category_confidence.lt.${min_confidence},category_confidence.is.null,category_code.is.null,category_code.ilike.NOISE.%`)
      .order("created_at", { ascending: false })
      .limit(batch_size);

    if (fetchError) {
      console.error("[reclassify] Fetch error:", fetchError);
      throw fetchError;
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0, 
          message: "No events need reclassification" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[reclassify] Found ${events.length} events to reclassify`);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in smaller chunks to avoid overwhelming the categorize-event function
    const chunkSize = 10;
    for (let i = 0; i < events.length; i += chunkSize) {
      const chunk = events.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (event) => {
        try {
          const domain = event.source_url 
            ? new URL(event.source_url).hostname.replace(/^www\./, '')
            : '';

          const { error: catError } = await supabase.functions.invoke('categorize-event', {
            body: {
              event_id: event.event_id,
              brand_id: event.brand_id,
              title: event.title || '',
              summary: event.description || '',
              content: event.description || '',
              source_domain: domain
            }
          });

          if (catError) {
            console.error(`[reclassify] Error for event ${event.event_id}:`, catError);
            failed++;
            errors.push(`${event.event_id}: ${catError.message}`);
          } else {
            processed++;
          }
        } catch (error: any) {
          console.error(`[reclassify] Exception for event ${event.event_id}:`, error);
          failed++;
          errors.push(`${event.event_id}: ${error.message}`);
        }
      }));

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < events.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[reclassify] Complete: ${processed} processed, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        failed,
        total: events.length,
        errors: errors.slice(0, 10) // Return first 10 errors for debugging
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[reclassify] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
