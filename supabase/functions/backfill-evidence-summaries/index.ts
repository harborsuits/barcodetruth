import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { limit = 50, dryRun = false } = await req.json();

    // Get event_sources that need summaries
    const { data: sources, error: fetchError } = await supabase
      .from('event_sources')
      .select(`
        id,
        event_id,
        source_name,
        article_title,
        article_snippet,
        credibility_tier,
        brand_events!inner(
          brand_id,
          category,
          raw_data,
          severity,
          occurred_at,
          brands!inner(name)
        )
      `)
      .is('ai_summary', null)
      .not('article_title', 'is', null)
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching sources:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sources', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No sources need summaries', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${sources.length} sources (dry run: ${dryRun})`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process each source
    for (const source of sources) {
      try {
        const brandEvent = Array.isArray(source.brand_events) 
          ? source.brand_events[0] 
          : source.brand_events;
        
        const brand = Array.isArray(brandEvent?.brands)
          ? brandEvent.brands[0]
          : brandEvent?.brands;

        if (!brand || !brandEvent) {
          console.warn(`Skipping source ${source.id}: missing brand or event data`);
          continue;
        }

        // Generate summary
        const summaryResponse = await supabase.functions.invoke('generate-evidence-summary', {
          body: {
            brandName: brand.name,
            category: brandEvent.category,
            articleTitle: source.article_title,
            articleSnippet: source.article_snippet,
            source: source.source_name,
            fineAmount: brandEvent.raw_data?.penalty_amount,
            severity: brandEvent.severity,
            date: brandEvent.occurred_at
          }
        });

        if (summaryResponse.error) {
          throw summaryResponse.error;
        }

        const summary = summaryResponse.data?.summary;

        if (!summary) {
          throw new Error('No summary returned');
        }

        // Update the source with the summary
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('event_sources')
            .update({ ai_summary: summary })
            .eq('id', source.id);

          if (updateError) {
            throw updateError;
          }
        }

        results.succeeded++;
        console.log(`✓ Generated summary for source ${source.id}`);
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          source_id: source.id,
          error: error.message
        });
        console.error(`✗ Failed for source ${source.id}:`, error.message);
      }

      results.processed++;

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Response(
      JSON.stringify({
        message: `Backfill complete`,
        dryRun,
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
