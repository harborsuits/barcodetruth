import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants matching personalizedScoring.ts
const HALF_LIFE_DAYS = 45;
const CATEGORIES = ['labor', 'environment', 'politics', 'social'] as const;
const CAP_PER_CATEGORY = 5;
const LOOKBACK_DAYS = 90;

type Category = typeof CATEGORIES[number];
type CategoryVector = Record<Category, number>;

// Severity mapping
function getSeverityValue(severity: string | null): number {
  switch (severity?.toLowerCase()) {
    case 'critical': return 1.0;
    case 'high': return 0.8;
    case 'medium': return 0.5;
    case 'low': return 0.3;
    default: return 0.5;
  }
}

// Verification factor mapping
function getVerificationFactor(verification: string | null): number {
  switch (verification) {
    case 'official': return 1.0;
    case 'corroborated': return 0.75;
    case 'unverified': return 0.5;
    default: return 0.1;
  }
}

// Recency decay
function recencyDecay(eventDate: string): number {
  const now = Date.now();
  const eventTime = new Date(eventDate).getTime();
  const ageDays = (now - eventTime) / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays * Math.LN2 / HALF_LIFE_DAYS);
}

// Compute news vector for a brand from its events
function computeNewsVector(events: any[]): CategoryVector {
  const vector: CategoryVector = { labor: 0, environment: 0, politics: 0, social: 0 };

  for (const event of events) {
    const impacts = event.category_impacts || {};
    const severity = getSeverityValue(event.severity);
    const credibility = event.credibility ?? 0.5;
    const verificationFactor = event.verification_factor ?? getVerificationFactor(event.verification);
    const eventDate = event.event_date || event.created_at;
    const decay = recencyDecay(eventDate);

    for (const cat of CATEGORIES) {
      const impact = impacts[cat] ?? 0;
      const contribution = impact * severity * credibility * verificationFactor * decay;
      vector[cat] += contribution;
    }
  }

  // Clamp each category
  for (const cat of CATEGORIES) {
    vector[cat] = Math.max(-CAP_PER_CATEGORY, Math.min(CAP_PER_CATEGORY, vector[cat]));
  }

  return vector;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { brandId, batchSize = 100 } = await req.json().catch(() => ({}));
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    
    // Staleness threshold: 24 hours
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let brandsToUpdate: string[] = [];

    if (brandId) {
      // Single brand update
      brandsToUpdate = [brandId];
    } else {
      // Batch: get brands that need updates (stale or null news_vector_updated_at)
      // Using dedicated timestamp instead of updated_at to avoid false staleness from unrelated edits
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id')
        .eq('is_active', true)
        .or(`news_vector_updated_at.is.null,news_vector_updated_at.lt.${staleThreshold}`)
        .limit(batchSize);

      if (brandsError) throw brandsError;
      brandsToUpdate = (brands || []).map(b => b.id);
    }

    if (brandsToUpdate.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No brands need updating', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const bid of brandsToUpdate) {
      try {
        // Fetch recent events for this brand
        const { data: events, error: eventsError } = await supabase
          .from('brand_events')
          .select('category_impacts, severity, credibility, verification_factor, verification, event_date, created_at')
          .eq('brand_id', bid)
          .gte('created_at', since.toISOString())
          .eq('is_irrelevant', false)
          .order('created_at', { ascending: false })
          .limit(200);

        if (eventsError) {
          errors.push(`Brand ${bid}: ${eventsError.message}`);
          continue;
        }

        // Compute the news vector
        const newsVector = computeNewsVector(events || []);

        // Update the brand with dedicated staleness timestamp
        const { error: updateError } = await supabase
          .from('brands')
          .update({ 
            news_vector_cache: newsVector,
            news_vector_updated_at: new Date().toISOString()
          })
          .eq('id', bid);

        if (updateError) {
          errors.push(`Brand ${bid}: ${updateError.message}`);
          continue;
        }

        updatedCount++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`Brand ${bid}: ${message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: updatedCount,
        total: brandsToUpdate.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in recompute-brand-vectors:', message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
