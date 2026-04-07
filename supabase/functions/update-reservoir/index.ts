// Reservoir: Adaptive Intelligence Layer — Pattern Detection + Decay
// Runs daily via pg_cron. Detects repeated behavioral signals across brand events.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const RECALL_KEYWORDS = ['recall', 'safety alert', 'consumer warning', 'fda warning', 'cpsc', 'product safety'];
const VIOLATION_KEYWORDS = ['osha', 'epa', 'violation', 'penalty', 'fine', 'citation', 'enforcement'];
const CERTIFICATION_KEYWORDS = ['b-corp', 'b corp', 'fair trade', 'organic certified', 'leed', 'energy star', 'rainforest alliance'];

const MAX_SIGNALS_PER_TYPE = 5;
const MIN_EVENTS_FOR_SIGNAL = 3;
const MIN_EVENTS_FOR_CATEGORY_SIGNAL = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Step 1: Get all brands with ≥3 score-eligible events
    const { data: brandCounts, error: countErr } = await supabase
      .from('brand_events')
      .select('brand_id')
      .eq('score_eligible', true)
      .eq('is_irrelevant', false);

    if (countErr) throw countErr;

    // Count events per brand
    const brandEventCounts = new Map<string, number>();
    for (const row of brandCounts || []) {
      brandEventCounts.set(row.brand_id, (brandEventCounts.get(row.brand_id) || 0) + 1);
    }

    // Filter to brands with ≥3 events
    const eligibleBrands = [...brandEventCounts.entries()]
      .filter(([_, count]) => count >= MIN_EVENTS_FOR_SIGNAL)
      .map(([id]) => id);

    console.log(`Reservoir: Processing ${eligibleBrands.length} eligible brands`);

    let signalsUpserted = 0;
    let signalsSkipped = 0;

    // Process in chunks of 50 brands
    for (let i = 0; i < eligibleBrands.length; i += 50) {
      const chunk = eligibleBrands.slice(i, i + 50);

      const { data: events, error: evErr } = await supabase
        .from('brand_events')
        .select('brand_id, title, description, category, verification, event_date, impact_labor, impact_environment, impact_politics, impact_social')
        .in('brand_id', chunk)
        .eq('score_eligible', true)
        .eq('is_irrelevant', false);

      if (evErr) {
        console.error('Error fetching events:', evErr);
        continue;
      }

      // Group events by brand
      const brandEvents = new Map<string, typeof events>();
      for (const ev of events || []) {
        if (!brandEvents.has(ev.brand_id)) brandEvents.set(ev.brand_id, []);
        brandEvents.get(ev.brand_id)!.push(ev);
      }

      for (const [brandId, bEvents] of brandEvents) {
        const signals: Array<{
          signal_type: string;
          brand_id: string;
          category: string | null;
          dimension: string;
          weight: number;
          confidence: number;
          evidence_count: number;
          last_seen: string;
        }> = [];

        // --- Detect recall patterns ---
        const recallEvents = bEvents.filter(ev => {
          const text = `${ev.title || ''} ${ev.description || ''}`.toLowerCase();
          return RECALL_KEYWORDS.some(kw => text.includes(kw));
        });

        if (recallEvents.length >= MIN_EVENTS_FOR_SIGNAL) {
          const lastSeen = getLatestDate(recallEvents);
          const recencyFactor = computeRecencyFactor(lastSeen);
          const corroboratedCount = recallEvents.filter(e => e.verification === 'official' || e.verification === 'corroborated').length;

          signals.push({
            signal_type: 'recall_pattern',
            brand_id: brandId,
            category: null,
            dimension: 'social',
            weight: Math.min(1.0, Math.min(recallEvents.length, MAX_SIGNALS_PER_TYPE) * 0.15 * recencyFactor),
            confidence: Math.min(1.0, Math.log(1 + corroboratedCount)),
            evidence_count: recallEvents.length,
            last_seen: lastSeen,
          });
        }

        // --- Detect violation patterns ---
        const violationEvents = bEvents.filter(ev => {
          const text = `${ev.title || ''} ${ev.description || ''}`.toLowerCase();
          return VIOLATION_KEYWORDS.some(kw => text.includes(kw));
        });

        if (violationEvents.length >= MIN_EVENTS_FOR_SIGNAL) {
          const lastSeen = getLatestDate(violationEvents);
          const recencyFactor = computeRecencyFactor(lastSeen);
          const corroboratedCount = violationEvents.filter(e => e.verification === 'official' || e.verification === 'corroborated').length;

          // Determine strongest dimension
          const dimSums = { labor: 0, environment: 0 };
          for (const ev of violationEvents) {
            dimSums.labor += Math.abs(ev.impact_labor || 0);
            dimSums.environment += Math.abs(ev.impact_environment || 0);
          }
          const strongDim = dimSums.labor >= dimSums.environment ? 'labor' : 'environment';

          signals.push({
            signal_type: 'violation_pattern',
            brand_id: brandId,
            category: null,
            dimension: strongDim,
            weight: Math.min(1.0, Math.min(violationEvents.length, MAX_SIGNALS_PER_TYPE) * 0.15 * recencyFactor),
            confidence: Math.min(1.0, Math.log(1 + corroboratedCount)),
            evidence_count: violationEvents.length,
            last_seen: lastSeen,
          });
        }

        // --- Detect certifications ---
        const certEvents = bEvents.filter(ev => {
          const text = `${ev.title || ''} ${ev.description || ''}`.toLowerCase();
          return CERTIFICATION_KEYWORDS.some(kw => text.includes(kw));
        });

        if (certEvents.length >= 1) { // Certifications are rarer, lower threshold
          const lastSeen = getLatestDate(certEvents);
          const recencyFactor = computeRecencyFactor(lastSeen);
          const corroboratedCount = certEvents.filter(e => e.verification === 'official' || e.verification === 'corroborated').length;

          signals.push({
            signal_type: 'certification_signal',
            brand_id: brandId,
            category: null,
            dimension: 'environment',
            weight: Math.min(1.0, Math.min(certEvents.length, MAX_SIGNALS_PER_TYPE) * 0.15 * recencyFactor),
            confidence: Math.min(1.0, Math.log(1 + corroboratedCount)),
            evidence_count: certEvents.length,
            last_seen: lastSeen,
          });
        }

        // Upsert signals
        for (const sig of signals) {
          // Noise floor: skip if weight * confidence < 0.1
          if (sig.weight * sig.confidence < 0.1) {
            signalsSkipped++;
            continue;
          }

          const { error: upsertErr } = await supabase
            .from('reservoir_signals')
            .upsert(sig, { onConflict: 'signal_type,brand_id,dimension' });

          if (upsertErr) {
            console.error(`Signal upsert error for ${brandId}:`, upsertErr);
          } else {
            signalsUpserted++;
          }
        }
      }
    }

    // Step 2: Daily decay — reduce all weights by 1%
    const { error: decayErr } = await supabase.rpc('reservoir_daily_decay');
    
    // Fallback if RPC doesn't exist yet — direct update
    if (decayErr) {
      console.log('RPC not available, running decay directly');
      await supabase
        .from('reservoir_signals')
        .update({ weight: 0 }) // Will be handled by raw SQL below
        .lt('weight', 0.01);
      
      // For proper decay, we need raw SQL via a function. Log for now.
      console.log('Note: Daily decay requires the reservoir_daily_decay database function');
    }

    const summary = {
      brands_processed: eligibleBrands.length,
      signals_upserted: signalsUpserted,
      signals_skipped_noise_floor: signalsSkipped,
    };

    console.log('Reservoir update complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Reservoir error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getLatestDate(events: Array<{ event_date: string | null }>): string {
  const dates = events
    .map(e => e.event_date)
    .filter(Boolean)
    .map(d => new Date(d!).getTime())
    .filter(t => !isNaN(t));
  
  return dates.length > 0
    ? new Date(Math.max(...dates)).toISOString()
    : new Date().toISOString();
}

function computeRecencyFactor(lastSeenIso: string): number {
  const daysSince = (Date.now() - new Date(lastSeenIso).getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-daysSince / 180);
}
