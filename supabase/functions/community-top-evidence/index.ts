import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Support both GET (query params) and POST (JSON body)
    let brand_id: string | null;
    let limit: number;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      brand_id = url.searchParams.get('brand_id');
      limit = parseInt(url.searchParams.get('limit') || '3', 10);
    } else {
      const body = await req.json();
      brand_id = body.brand_id;
      limit = parseInt(body.limit || '3', 10);
    }

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: 'brand_id parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get most cited events
    const { data: eventCounts, error: countError } = await supabase
      .from('community_ratings')
      .select('evidence_event_id')
      .eq('brand_id', brand_id)
      .not('evidence_event_id', 'is', null);

    if (countError) {
      throw countError;
    }

    // Count occurrences
    const eventMap = new Map<string, number>();
    (eventCounts || []).forEach((row: any) => {
      const id = row.evidence_event_id;
      eventMap.set(id, (eventMap.get(id) || 0) + 1);
    });

    // Sort by count and get top N
    const topEventIds = Array.from(eventMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topEventIds.length === 0) {
      return new Response(
        JSON.stringify({ brand_id, evidence: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch event details
    const { data: events, error: eventsError } = await supabase
      .from('brand_events')
      .select('event_id, title, category, event_date, verification')
      .in('event_id', topEventIds)
      .limit(limit);

    if (eventsError) {
      throw eventsError;
    }

    // Add citation counts
    const evidence = (events || []).map((event: any) => ({
      ...event,
      citation_count: eventMap.get(event.event_id) || 0,
    })).sort((a, b) => b.citation_count - a.citation_count);

    return new Response(
      JSON.stringify({ brand_id, evidence }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in community-top-evidence:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
