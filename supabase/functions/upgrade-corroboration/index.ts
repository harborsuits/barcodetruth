import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClusterRow {
  brand_id: string;
  category: string;
  day: string;
  title_fp: string;
  domains: string[];
  domain_count: number;
  avg_cred: number;
  event_ids: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting corroboration upgrade job...');

    // Query for clusters with ≥2 domains and good credibility
    const { data: clusters, error: clusterError } = await supabase.rpc('get_corroboration_clusters', {
      min_domains: 2,
      min_credibility: 0.60,
      window_days: 7
    });

    if (clusterError) {
      console.error('Cluster query error:', clusterError);
      throw clusterError;
    }

    if (!clusters || clusters.length === 0) {
      console.log('✅ No events meet corroboration criteria');
      return new Response(JSON.stringify({ 
        upgraded: 0,
        message: 'No events to upgrade'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let upgraded = 0;
    const auditRows = [];

    // Process each cluster
    for (const cluster of clusters as ClusterRow[]) {
      const eventIds = cluster.event_ids;
      
      // Update events to corroborated
      const { error: updateError } = await supabase
        .from('brand_events')
        .update({ verification: 'corroborated' })
        .in('event_id', eventIds)
        .eq('verification', 'unverified'); // Only upgrade unverified → corroborated

      if (updateError) {
        console.error(`Error upgrading events ${eventIds}:`, updateError);
        continue;
      }

      // Create audit records
      for (const eventId of eventIds) {
        auditRows.push({
          event_id: eventId,
          from_status: 'unverified',
          to_status: 'corroborated',
          reason: `Auto-upgraded: ${cluster.domain_count} independent domains, avg credibility ${(cluster.avg_cred * 100).toFixed(0)}%`
        });
      }

      upgraded += eventIds.length;
    }

    // Insert audit records
    if (auditRows.length > 0) {
      const { error: auditError } = await supabase
        .from('verification_audit')
        .insert(auditRows);

      if (auditError) {
        console.error('Audit insert error:', auditError);
        // Don't fail the job if audit fails
      }
    }

    console.log(`✅ Upgraded ${upgraded} events to corroborated`);

    return new Response(JSON.stringify({
      upgraded,
      clusters: clusters.length,
      message: `Successfully upgraded ${upgraded} events`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Corroboration upgrade error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
