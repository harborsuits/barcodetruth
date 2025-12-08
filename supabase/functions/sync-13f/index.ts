// Sync SEC 13F institutional holders from Financial Modeling Prep API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FMPHolder {
  cik?: string;
  investorName?: string;
  investorname?: string;
  name?: string;
  shares?: number;
  value?: number;
  weight?: number;
  dateReported?: string;
  filingDate?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const FMP_API_KEY = Deno.env.get('FMP_API_KEY');
  if (!FMP_API_KEY) {
    console.error('[sync-13f] FMP_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'FMP_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get ticker from query params or body
    let ticker: string | null = null;
    
    const url = new URL(req.url);
    ticker = url.searchParams.get('ticker');
    
    if (!ticker && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      ticker = body.ticker;
    }

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'ticker required (query param or POST body)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    ticker = ticker.toUpperCase();
    console.log(`[sync-13f] Syncing institutional holders for ticker: ${ticker}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 1) Resolve company_id from companies table
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id, name, ticker')
      .eq('ticker', ticker)
      .maybeSingle();

    if (companyErr) {
      console.error('[sync-13f] Error finding company:', companyErr);
      return new Response(
        JSON.stringify({ error: 'database error', details: companyErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!company) {
      console.log(`[sync-13f] Company not found for ticker ${ticker}, attempting to create...`);
      
      // Try to get company profile from FMP first
      const profileRes = await fetch(
        `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${FMP_API_KEY}`
      );
      
      if (!profileRes.ok) {
        return new Response(
          JSON.stringify({ error: 'Company not found and could not fetch from FMP', ticker }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const profiles = await profileRes.json();
      const profile = profiles?.[0];
      
      if (!profile) {
        return new Response(
          JSON.stringify({ error: 'Company profile not found in FMP', ticker }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the company
      const { data: newCompany, error: createErr } = await supabase
        .from('companies')
        .insert({
          name: profile.companyName || ticker,
          ticker: ticker,
          exchange: profile.exchangeShortName || null,
          industry: profile.industry || null,
          sector: profile.sector || null,
          country: profile.country || null,
          website: profile.website || null,
          description: profile.description || null,
        })
        .select('id, name, ticker')
        .single();

      if (createErr) {
        console.error('[sync-13f] Error creating company:', createErr);
        return new Response(
          JSON.stringify({ error: 'Failed to create company', details: createErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[sync-13f] Created company: ${newCompany.name} (${newCompany.id})`);
      // Use the newly created company
      Object.assign(company || {}, newCompany);
    }

    const companyId = company?.id;
    const companyName = company?.name;
    
    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve company ID', ticker }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-13f] Found company: ${companyName} (${companyId})`);

    // 2) Call FMP institutional holders endpoint
    const fmpUrl = `https://financialmodelingprep.com/api/v3/institutional-holder/${ticker}?apikey=${FMP_API_KEY}`;
    console.log(`[sync-13f] Fetching from FMP: ${fmpUrl.replace(FMP_API_KEY, '***')}`);
    
    const fmpRes = await fetch(fmpUrl);
    
    if (!fmpRes.ok) {
      const text = await fmpRes.text();
      console.error('[sync-13f] FMP API error:', fmpRes.status, text);
      return new Response(
        JSON.stringify({ error: 'FMP API error', status: fmpRes.status, details: text }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const holders: FMPHolder[] = await fmpRes.json();
    console.log(`[sync-13f] FMP returned ${holders?.length || 0} holders`);

    if (!Array.isArray(holders) || holders.length === 0) {
      return new Response(
        JSON.stringify({ 
          ok: true, 
          count: 0, 
          message: 'No institutional holders found for this ticker',
          company_id: companyId,
          company_name: companyName
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3) Normalize and prepare rows
    const rows = holders.map((h) => ({
      company_id: companyId,
      cik: h.cik ?? null,
      holder_name: h.investorName || h.investorname || h.name || 'Unknown',
      shares: h.shares ?? null,
      position_value: h.value ?? null,
      percent_outstanding: h.weight ?? null,
      reported_at: h.dateReported || h.filingDate || null,
      source: 'fmp_13f',
    }));

    // 4) Delete old rows for this company, then insert fresh
    const { error: deleteErr } = await supabase
      .from('company_institutional_holders')
      .delete()
      .eq('company_id', companyId);

    if (deleteErr) {
      console.error('[sync-13f] Error deleting old holders:', deleteErr);
    }

    const { error: insertErr } = await supabase
      .from('company_institutional_holders')
      .insert(rows);

    if (insertErr) {
      console.error('[sync-13f] Error inserting holders:', insertErr);
      return new Response(
        JSON.stringify({ error: 'Insert failed', details: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-13f] Successfully synced ${rows.length} holders for ${companyName}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        count: rows.length,
        company_id: companyId,
        company_name: companyName,
        sample: rows.slice(0, 3).map(r => ({ name: r.holder_name, shares: r.shares }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('[sync-13f] Unexpected error:', e);
    return new Response(
      JSON.stringify({ error: 'Unexpected error', details: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
