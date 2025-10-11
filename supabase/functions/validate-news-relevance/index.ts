import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateRequest {
  article_url: string;
  article_title: string;
  article_summary: string;
  brand_name: string;
  claimed_category: string;
}

/**
 * Validates if a news article actually substantiates the claimed brand event.
 * Returns relevance score (0-1) and verification level.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { article_url, article_title, article_summary, brand_name, claimed_category } = await req.json() as ValidateRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`[validate-news] Validating article: ${article_title.slice(0, 60)}...`);

    // Fetch article content (with timeout)
    let fullContent = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const contentResponse = await fetch(article_url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ShopSignals/1.0' }
      });
      clearTimeout(timeoutId);

      if (contentResponse.ok) {
        const html = await contentResponse.text();
        // Simple content extraction (strip HTML tags)
        fullContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 10000); // Cap at 10k chars
      }
    } catch (err) {
      console.warn(`[validate-news] Could not fetch content: ${err}`);
      fullContent = article_summary; // Fallback to summary
    }

    // Use AI to validate relevance
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
            content: `You validate if news articles substantiate brand events. Return structured JSON with:
- relevance_score: 0.0-1.0 (how well article proves the event)
- is_substantive: boolean (does it provide real evidence?)
- verification_level: "official" | "corroborated" | "unverified"
- specific_facts: array of concrete facts extracted (names, dates, amounts)
- rejection_reason: string if relevance < 0.5

Relevance scoring:
- 0.9-1.0: Article directly reports the specific event with details
- 0.7-0.9: Article confirms event but limited details
- 0.5-0.7: Article mentions event tangentially
- 0.3-0.5: Article mentions brand + keywords but not the event
- 0.0-0.3: False positive - unrelated article

Verification:
- official: Government source, court records, official statements
- corroborated: Credible news org with specific facts
- unverified: Mentions but no substantive details`
          },
          {
            role: 'user',
            content: `Brand: ${brand_name}
Claimed Category: ${claimed_category}
Article Title: ${article_title}
Article Summary: ${article_summary}

Full Content (first 10k chars):
${fullContent}

Does this article substantiate a real ${claimed_category} event for ${brand_name}?`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'validate_relevance',
              description: 'Validate news article relevance to brand event',
              parameters: {
                type: 'object',
                properties: {
                  relevance_score: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    description: 'How well article proves the event (0-1)'
                  },
                  is_substantive: {
                    type: 'boolean',
                    description: 'Does it provide real evidence with specifics?'
                  },
                  verification_level: {
                    type: 'string',
                    enum: ['official', 'corroborated', 'unverified']
                  },
                  specific_facts: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Concrete facts: names, dates, amounts, locations'
                  },
                  rejection_reason: {
                    type: 'string',
                    description: 'Why article is not relevant (if score < 0.5)'
                  },
                  extracted_quote: {
                    type: 'string',
                    description: 'Best quote from article (max 200 chars)'
                  }
                },
                required: ['relevance_score', 'is_substantive', 'verification_level', 'specific_facts']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'validate_relevance' } }
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No validation result from AI');
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    console.log(`[validate-news] Relevance: ${result.relevance_score}, Substantive: ${result.is_substantive}`);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-news] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
