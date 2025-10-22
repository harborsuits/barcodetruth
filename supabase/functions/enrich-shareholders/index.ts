import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Enrich company shareholders from public filings
 * Sources: SEC 13F filings (institutional holders)
 * Target: company_shareholders table
 * 
 * Note: This is a placeholder implementation. In production, you would:
 * 1. Use SEC EDGAR API or a financial data provider
 * 2. Parse 13F filings for institutional holdings
 * 3. Or integrate with services like Alpha Vantage, Financial Modeling Prep, etc.
 */

interface Shareholder {
  holder_name: string;
  holder_name_raw: string;
  holder_type: 'institutional' | 'insider' | 'retail_estimate';
  percent_owned: number;
  is_asset_manager: boolean;
  as_of_date: string;
  source_name: string;
  source_url?: string;
}

// Asset manager detection (normalize names for matching)
const ASSET_MANAGER_KEYWORDS = [
  'vanguard', 'blackrock', 'state street', 'fidelity', 'capital group',
  'jpmorgan', 'invesco', 'amundi', 'legal & general', 'northern trust',
  'charles schwab', 'goldman sachs', 'morgan stanley', 'ubs', 'credit suisse',
  'deutsche bank', 'hsbc', 'barclays', 'wellington', 'franklin templeton'
];

function normalizeHolderName(name: string): string {
  return name.toLowerCase()
    .replace(/\s+(inc|llc|lp|corp|corporation|company|co|ltd|limited|group)\.?$/gi, '')
    .trim();
}

function isAssetManager(holderName: string): boolean {
  const normalized = normalizeHolderName(holderName);
  return ASSET_MANAGER_KEYWORDS.some(keyword => normalized.includes(keyword));
}

async function fetchTopShareholders(ticker: string, companyId: string): Promise<Shareholder[]> {
  // PLACEHOLDER: In production, integrate with:
  // - SEC EDGAR API for 13F filings
  // - Alpha Vantage (institutional_ownership)
  // - Financial Modeling Prep
  // - Yahoo Finance API (unofficial)
  
  console.log(`[enrich-shareholders] Would fetch shareholders for ticker: ${ticker}`);
  
  // Example structure for when you implement the real API:
  // const response = await fetch(`https://api.example.com/shareholders/${ticker}`);
  // const data = await response.json();
  
  // For now, return empty array
  // When implemented, parse the response and return Shareholder[] with proper structure
  
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let companyId: string | null = null;
  let rowsWritten = 0;
  let status = 'success';
  let errorMsg: string | null = null;

  try {
    const { company_id, ticker } = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'Missing company_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'Missing ticker (required for public companies)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    companyId = company_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`[enrich-shareholders] Fetching shareholders for ${ticker}`);

    // Fetch top institutional shareholders
    const shareholders = await fetchTopShareholders(ticker, company_id);

    if (shareholders.length === 0) {
      errorMsg = 'No shareholders found or API not implemented';
      status = 'partial';
      console.log('[enrich-shareholders] No shareholders data available');
    } else {
      // Validate and clean data
      const cleanedShareholders = shareholders
        .filter(s => s.holder_type === 'institutional' && s.percent_owned > 0)
        .slice(0, 10); // Top 10 only

      // Upsert shareholders (idempotent)
      for (const holder of cleanedShareholders) {
        // Detect asset managers
        const isAssetMgr = isAssetManager(holder.holder_name);

        const { error: upsertError } = await supabase
          .from('company_shareholders')
          .upsert({
            company_id,
            holder_name: normalizeHolderName(holder.holder_name),
            holder_name_raw: holder.holder_name,
            holder_type: holder.holder_type,
            percent_owned: Math.round(holder.percent_owned * 100) / 100, // Round to 2 decimals
            is_asset_manager: isAssetMgr,
            as_of_date: holder.as_of_date,
            source: holder.source_name,
            source_name: holder.source_name,
            source_url: holder.source_url
          }, {
            onConflict: 'company_id,holder_name,as_of_date',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`[enrich-shareholders] Failed to upsert ${holder.holder_name}:`, upsertError);
          if (status === 'success') status = 'partial';
        } else {
          rowsWritten++;
          console.log(`[enrich-shareholders] Added: ${holder.holder_name} (${holder.percent_owned}%)`);
        }
      }
    }

    // Log enrichment run
    await supabase.from('enrichment_runs').insert({
      brand_id: null, // Shareholders are company-level
      task: 'shareholders',
      rows_written: rowsWritten,
      status: rowsWritten > 0 ? 'success' : status,
      error: errorMsg,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({ 
        message: rowsWritten > 0 ? 'Shareholders enriched successfully' : 'No shareholders found', 
        count: rowsWritten,
        note: 'API integration placeholder - implement with SEC EDGAR or financial data provider'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[enrich-shareholders] Error:', error);
    
    // Log failed run
    if (companyId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase.from('enrichment_runs').insert({
          brand_id: null,
          task: 'shareholders',
          rows_written: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });
      } catch {}
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
