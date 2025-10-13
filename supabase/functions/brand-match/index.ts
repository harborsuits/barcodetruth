import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const INTERNAL = Deno.env.get('INTERNAL_FN_TOKEN');
const BATCH = parseInt(Deno.env.get('MATCH_BATCH') || '25', 10);
const ACCEPT_THRESHOLD = 0.80;

type Item = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  published_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Internal gating
  if ((req.headers.get('x-internal-token') || '') !== (INTERNAL || '')) {
    console.log(JSON.stringify({ level: 'warn', fn: 'brand-match', blocked: true }));
    return new Response(JSON.stringify({ error: 'Forbidden' }), { 
      status: 403, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1) Pull a batch of queued items
    const { data: items, error: itemsErr } = await supabase
      .from('rss_items')
      .select('id, title, summary, url, published_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(BATCH);

    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[brand-match] Processing ${items.length} items`);

    // Helper: run deterministic SQL candidates (aliases + trigram)
    const pickCandidates = async (item: Item) => {
      const title = item.title || '';
      const summary = item.summary || '';

      // 2a) Alias hits (strong)
      const { data: aliasHits, error: aliasErr } = await supabase.rpc('app_brand_alias_candidates', {
        p_title: title,
        p_summary: summary
      });
      if (aliasErr) {
        console.error('Alias candidates error:', aliasErr);
        throw aliasErr;
      }

      // 2b) Trigram fuzzy against brand names (medium)
      const { data: trigramHits, error: trgErr } = await supabase.rpc('app_brand_trigram_candidates', {
        p_title: title
      });
      if (trgErr) {
        console.error('Trigram candidates error:', trgErr);
        throw trgErr;
      }

      // Merge and sort by confidence desc
      const combined = [...(aliasHits || []), ...(trigramHits || [])]
        .sort((a, b) => b.confidence - a.confidence);

      return combined.slice(0, 5);
    };

    // 3) Process each item
    let processed = 0, matched = 0, skipped = 0;

    for (const item of items) {
      try {
        const candidates = await pickCandidates(item);
        const top = candidates[0];

        if (top && top.confidence >= ACCEPT_THRESHOLD) {
          // Record match
          await supabase.from('article_brand_matches').upsert({
            item_id: item.id,
            brand_id: top.brand_id,
            confidence: top.confidence,
            method: top.method,
            decided: true,
            decided_at: new Date().toISOString()
          }, { onConflict: 'item_id,brand_id' });

          // Create event + source
          const eventId = crypto.randomUUID();
          const { error: evtErr } = await supabase
            .from('brand_events')
            .insert({
              event_id: eventId,
              brand_id: top.brand_id,
              category: 'social',
              title: item.title,
              description: item.summary || item.title,
              occurred_at: item.published_at ?? new Date().toISOString(),
              verification: 'corroborated'
            });

          if (evtErr) {
            console.error('Event insert error:', evtErr);
          } else {
            await supabase.from('event_sources').insert({
              id: crypto.randomUUID(),
              event_id: eventId,
              source_name: 'RSS',
              source_url: item.url,
              canonical_url: item.url,
              credibility_tier: 'reputable',
              link_kind: 'article',
              evidence_status: 'resolved',
              source_date: item.published_at ?? new Date().toISOString()
            });
          }

          await supabase.from('rss_items').update({ status: 'matched' }).eq('id', item.id);
          matched++;
        } else {
          await supabase.from('rss_items').update({ status: 'skipped' }).eq('id', item.id);
          skipped++;
        }

        processed++;
      } catch (e) {
        console.error('Item processing error:', e);
        await supabase.from('rss_items').update({ status: 'error' }).eq('id', item.id);
        processed++;
      }
    }

    console.log(`[brand-match] Processed: ${processed}, Matched: ${matched}, Skipped: ${skipped}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed, 
      matched, 
      skipped 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (e: any) {
    console.error('[brand-match] Error:', e);
    return new Response(JSON.stringify({ 
      error: e.message || String(e) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
