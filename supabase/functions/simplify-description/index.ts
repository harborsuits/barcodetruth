import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, category, title } = await req.json();

    if (!description) {
      return new Response(JSON.stringify({ error: 'Description required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are a helpful assistant that explains complex business, legal, and regulatory information in simple, everyday language that anyone can understand. 

Your job is to take technical descriptions of corporate events (like OSHA violations, EPA actions, FEC donations, etc.) and rewrite them in plain English that a regular person would understand.

Rules:
- Use simple, everyday words (avoid jargon like "non-compliance", "violation", "remediation")
- Keep it short (2-3 sentences max)
- Focus on what actually happened and why it matters to regular people
- If there are safety issues, say "safety problem" not "OSHA violation"
- If there are fines, explain what they did wrong in simple terms
- Be factual but conversational`;

    const userPrompt = `Explain this ${category || 'event'} in simple terms that anyone can understand:

Title: ${title || 'Event'}
Description: ${description}

Rewrite this so a regular person knows exactly what happened and why it matters.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      console.error('AI gateway error:', response.status, await response.text());
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Service unavailable. Please contact support.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Failed to generate explanation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const simplified = data.choices?.[0]?.message?.content;

    if (!simplified) {
      throw new Error('No response from AI');
    }

    return new Response(JSON.stringify({ simplified }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in simplify-description:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
