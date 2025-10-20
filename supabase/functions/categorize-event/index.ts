import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CategorizeRequest {
  description: string;
  source_name?: string;
  source_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, source_name, source_url } = await req.json() as CategorizeRequest;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use Lovable AI to categorize and extract structured data
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an event categorization system for ShopSignals, a brand ethics app. 

Analyze the event description and return structured JSON with:
- category_code: hierarchical category code (see taxonomy below)
- severity: one of [minor, moderate, severe]
- orientation: one of [positive, negative, mixed]
- suggested_impact: object with numeric scores for affected categories (-20 to +20)

Category Taxonomy (use these exact codes):
- FIN.EARNINGS: earnings reports, revenue, profits
- FIN.ACQUISITION: mergers, acquisitions, investments
- FIN.BANKRUPTCY: bankruptcy, financial distress
- PRODUCT.RECALL: product recalls, safety issues
- PRODUCT.LAUNCH: new product launches
- LEGAL.LAWSUIT: lawsuits, litigation
- LEGAL.SETTLEMENT: legal settlements
- LEGAL.INVESTIGATION: regulatory investigations
- REGULATORY.VIOLATION: regulatory violations, fines
- REGULATORY.COMPLIANCE: compliance updates
- LABOR.SAFETY: workplace safety, OSHA violations
- LABOR.WAGES: wage issues, pay disputes
- LABOR.UNION: union activity, collective bargaining
- LABOR.DISCRIMINATION: discrimination, harassment claims
- ESG.ENVIRONMENT: emissions, pollution, environmental impact
- ESG.SOCIAL: diversity, community impact, philanthropy
- ESG.GOVERNANCE: corporate governance, board changes
- POLICY.POLITICAL: political donations, lobbying
- POLICY.ADVOCACY: advocacy, public positions
- SOCIAL.BOYCOTT: boycotts, protests
- SOCIAL.CAMPAIGN: social campaigns, movements
- NOISE.FINANCIAL: stock trades, investment positions, financial advisors buying/selling shares
- NOISE.GENERAL: general news, announcements, other

Be neutral and cite-only. Never add judgment.`
          },
          {
            role: 'user',
            content: `Event: "${description}"
Source: ${source_name || 'Unknown'}
URL: ${source_url || 'N/A'}

Categorize this event.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'categorize_event',
              description: 'Categorize a brand event with structured data',
              parameters: {
                type: 'object',
                properties: {
                  category_code: {
                    type: 'string',
                    enum: [
                      'FIN.EARNINGS', 'FIN.ACQUISITION', 'FIN.BANKRUPTCY',
                      'PRODUCT.RECALL', 'PRODUCT.LAUNCH',
                      'LEGAL.LAWSUIT', 'LEGAL.SETTLEMENT', 'LEGAL.INVESTIGATION',
                      'REGULATORY.VIOLATION', 'REGULATORY.COMPLIANCE',
                      'LABOR.SAFETY', 'LABOR.WAGES', 'LABOR.UNION', 'LABOR.DISCRIMINATION',
                      'ESG.ENVIRONMENT', 'ESG.SOCIAL', 'ESG.GOVERNANCE',
                      'POLICY.POLITICAL', 'POLICY.ADVOCACY',
                      'SOCIAL.BOYCOTT', 'SOCIAL.CAMPAIGN',
                      'NOISE.GENERAL', 'NOISE.FINANCIAL'
                    ]
                  },
                  severity: {
                    type: 'string',
                    enum: ['minor', 'moderate', 'severe']
                  },
                  orientation: {
                    type: 'string',
                    enum: ['positive', 'negative', 'mixed']
                  },
                  suggested_impact: {
                    type: 'object',
                    properties: {
                      labor: { type: 'integer', minimum: -20, maximum: 20 },
                      environment: { type: 'integer', minimum: -20, maximum: 20 },
                      politics: { type: 'integer', minimum: -20, maximum: 20 },
                      social: { type: 'integer', minimum: -20, maximum: 20 }
                    }
                  },
                  reasoning: {
                    type: 'string',
                    description: 'Brief explanation of the categorization'
                  }
                },
                required: ['category_code', 'severity', 'orientation', 'suggested_impact']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'categorize_event' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No categorization returned from AI');
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    console.log('Event categorized:', { description: description.slice(0, 100), result });

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Categorization error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
