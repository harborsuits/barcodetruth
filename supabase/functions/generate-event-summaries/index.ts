import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Accept both JSON body and query params for flexibility
    let brandId: string | null = null;
    let limit = 50;
    
    if (req.method === 'POST') {
      const body = await req.json();
      brandId = body.brand_id;
      limit = body.limit || 50;
    } else {
      const url = new URL(req.url);
      brandId = url.searchParams.get('brand_id');
      limit = parseInt(url.searchParams.get('limit') || '50');
    }

    console.log('[generate-event-summaries] Parsed params:', { brandId, limit });
    
    if (!brandId) {
      console.error('[generate-event-summaries] Missing required parameter: brand_id');
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameter: brand_id",
          received: { brandId, limit }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-event-summaries] Processing brand: ${brandId}, limit: ${limit}`);

    // Get recent events without AI summaries for this brand
    const { data: events, error: eventsError } = await supabase
      .from('brand_events')
      .select(`
        event_id,
        title,
        description,
        category,
        verification,
        event_date,
        raw_data,
        event_sources(
          title,
          article_snippet,
          source_name,
          canonical_url
        )
      `)
      .eq('brand_id', brandId)
      .is('ai_summary', null)
      .order('event_date', { ascending: false })
      .limit(limit);

    if (eventsError) {
      console.error('[generate-event-summaries] Query error:', eventsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch events" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!events || events.length === 0) {
      console.log(`[generate-event-summaries] No events need summaries for brand ${brandId}`);
      return new Response(
        JSON.stringify({ 
          success: true,
          processed: 0,
          note: "No events need summaries"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-event-summaries] Found ${events.length} events to summarize`);

    let processed = 0;
    let failed = 0;

    for (const event of events) {
      try {
        // Build context for AI
        const sources = Array.isArray(event.event_sources) ? event.event_sources : [];
        const sourcesContext = sources
          .map(s => `Source: ${s.source_name || 'Unknown'}\nTitle: ${s.title || 'N/A'}\nSnippet: ${s.article_snippet || 'N/A'}`)
          .join('\n\n');

        const prompt = `Summarize this event in 2-3 sentences for a consumer transparency app. Focus on the key facts and impact.

Event Title: ${event.title}
Description: ${event.description}
Category: ${event.category}
Verification: ${event.verification}
Date: ${event.event_date}

Sources:
${sourcesContext}

Raw Data: ${JSON.stringify(event.raw_data, null, 2)}

Provide a concise, factual summary that helps consumers understand what happened and why it matters.`;

        // Use Anthropic API directly
        const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (!anthropicKey) {
          console.error('[generate-event-summaries] ANTHROPIC_API_KEY not configured');
          failed++;
          continue;
        }

        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 300,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          })
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`[generate-event-summaries] AI request failed for event ${event.event_id}: ${aiResponse.status} - ${errorText}`);
          failed++;
          continue;
        }

        const aiResult = await aiResponse.json();
        const summary = aiResult.content?.[0]?.text;

        if (!summary) {
          console.error(`[generate-event-summaries] No summary generated for event ${event.event_id}`);
          failed++;
          continue;
        }

        // Update event with AI summary
        const { error: updateError } = await supabase
          .from('brand_events')
          .update({
            ai_summary: summary,
            ai_model_version: 'claude-sonnet-4-5'
          })
          .eq('event_id', event.event_id);

        if (updateError) {
          console.error(`[generate-event-summaries] Update failed for event ${event.event_id}:`, updateError);
          failed++;
          continue;
        }

        processed++;
        console.log(`[generate-event-summaries] ✅ Generated summary for event ${event.event_id}`);

        // Rate limit to avoid overwhelming AI service
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`[generate-event-summaries] Error processing event ${event.event_id}:`, error);
        failed++;
      }
    }

    console.log(`[generate-event-summaries] Complete: ${processed} summaries generated, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed,
        failed,
        total: events.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[generate-event-summaries] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
