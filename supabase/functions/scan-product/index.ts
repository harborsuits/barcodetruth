// TICKET B: Scan product API endpoint
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const reqSchema = {
  upc: (v: any) => typeof v === 'string' && v.length >= 8 && v.length <= 18
};

interface ScanResult {
  product_id: string;
  upc: string;
  product_name: string;
  size?: string | null;
  category?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
  score?: number | null;
  score_updated?: string | null;
  events_90d: number;
  verified_rate: number;
  independent_sources: number;
}

function normalizeUPC(raw: string): string {
  return raw.replace(/[^0-9]/g, '').trim();
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    
    // Validate request
    if (!body.upc || !reqSchema.upc(body.upc)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: 'upc must be 8-18 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize UPC
    const upc = normalizeUPC(body.upc);
    if (upc.length < 8 || upc.length > 14) {
      return new Response(
        JSON.stringify({ error: 'UPC must be 8-14 digits after normalization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query product with brand and score data
    const { data: rows, error } = await supabase.rpc('scan_product_lookup', { 
      p_upc: upc 
    });

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Database query failed', message: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: ScanResult = {
      product_id: rows[0].product_id,
      upc: rows[0].upc,
      product_name: rows[0].product_name,
      size: rows[0].size,
      category: rows[0].category,
      brand_id: rows[0].brand_id,
      brand_name: rows[0].brand_name,
      score: rows[0].score,
      score_updated: rows[0].score_updated,
      events_90d: rows[0].events_90d || 0,
      verified_rate: rows[0].verified_rate || 0,
      independent_sources: rows[0].independent_sources || 0
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('Scan error:', e);
    return new Response(
      JSON.stringify({ error: 'Scan failed', message: e?.message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
