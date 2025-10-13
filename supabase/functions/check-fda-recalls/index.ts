import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FDARecallResult {
  status: string;
  classification: string;
  product_description: string;
  reason_for_recall: string;
  recall_initiation_date: string;
  recalling_firm: string;
  distribution_pattern?: string;
  code_info?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'Barcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking FDA recalls for barcode: ${barcode}`);

    // Query openFDA API for recalls matching this UPC
    const fdaUrl = `https://api.fda.gov/food/enforcement.json?search=code_info:"${barcode}"&limit=10`;
    
    const response = await fetch(fdaUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        // No recalls found - this is good!
        return new Response(
          JSON.stringify({ recalls: [], message: 'No recalls found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`FDA API error: ${response.status}`);
    }

    const data = await response.json();
    
    const recalls: FDARecallResult[] = (data.results || []).map((r: any) => ({
      status: r.status,
      classification: r.classification,
      product_description: r.product_description,
      reason_for_recall: r.reason_for_recall,
      recall_initiation_date: r.recall_initiation_date,
      recalling_firm: r.recalling_firm,
      distribution_pattern: r.distribution_pattern,
      code_info: r.code_info,
    }));

    console.log(`Found ${recalls.length} recalls for barcode ${barcode}`);

    return new Response(
      JSON.stringify({ 
        recalls,
        count: recalls.length,
        message: recalls.length > 0 ? 'Recalls found' : 'No recalls found'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking FDA recalls:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
