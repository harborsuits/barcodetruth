import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { requireInternal } from '../_shared/internal.ts';

const BATCH = parseInt(Deno.env.get('MATCH_BATCH') || '25', 10);
const ACCEPT_THRESHOLD = 0.80;

// EMERGENCY VALIDATION: Prevent patents/trademarks/generic descriptions from being created as brands
const INVALID_BRAND_PATTERNS = [
  /^(US patent|EP patent|patent|trademark)/i,
  /patent \d{5,}/i,
  /\d{5,}/,  // Long number sequences
  /^(article of|product of|method of|system for|apparatus)/i,
  /^(braided|reinforced|woven|knitted|molded) (article|item|product)/i,
  /(footwear including|sole assembly|content page generation)/i,
  /^(including|featuring|with|containing)/i,
  /©|®|™/,
  /^(component of|element of|part of|unnamed|nnamed)/i
];

function isValidBrandName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;
  if (name.length > 50) return false;  // Brand names shouldn't be descriptions
  if (INVALID_BRAND_PATTERNS.some(pattern => pattern.test(name))) {
    console.log(`[brand-match] ⚠️ Rejected invalid brand name: "${name}"`);
    return false;
  }
  return true;
}

type Item = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  published_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const guard = requireInternal(req, 'brand-match');
  if (guard) return guard;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Rate limiting check
  const MIN_GAP_MS = 3 * 60 * 1000; // 3 minutes
  const { data: lastRun } = await supabase
    .from('cron_runs')
    .select('last_run')
    .eq('fn', 'brand-match')
    .maybeSingle();

  if (lastRun?.last_run) {
    const elapsed = Date.now() - new Date(lastRun.last_run).getTime();
    if (elapsed < MIN_GAP_MS) {
      console.log(`[brand-match] Rate limited: last run ${Math.round(elapsed/1000)}s ago`);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'recent-run', retry_after: Math.ceil((MIN_GAP_MS - elapsed)/1000) }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Update last run timestamp
  await supabase.from('cron_runs').upsert({ 
    fn: 'brand-match', 
    last_run: new Date().toISOString() 
  });

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

          // Create event + source (with conflict handling)
          const eventId = crypto.randomUUID();
          const { data: evtData, error: evtErr } = await supabase
            .from('brand_events')
            .insert({
              event_id: eventId,
              brand_id: top.brand_id,
              category: 'social',
              title: item.title,
              description: item.summary || item.title,
              occurred_at: item.published_at ?? new Date().toISOString(),
              verification: 'corroborated',
              source_url: item.url
            })
            .select()
            .single();

          if (evtErr) {
            console.error(`[brand-match] Event insert failed for item ${item.id}:`, JSON.stringify(evtErr));
            // If duplicate source_url, try to find existing event
            if (evtErr.code === '23505') {
              const { data: existing } = await supabase
                .from('brand_events')
                .select('event_id')
                .eq('source_url', item.url)
                .single();
              
              if (existing) {
                console.log(`[brand-match] Using existing event ${existing.event_id} for duplicate URL`);
                await supabase.from('rss_items').update({ status: 'matched' }).eq('id', item.id);
                matched++;
                continue;
              }
            }
            throw evtErr;
          }

          const { error: srcErr } = await supabase.from('event_sources').insert({
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

          if (srcErr) {
            console.error(`[brand-match] Source insert failed:`, JSON.stringify(srcErr));
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
