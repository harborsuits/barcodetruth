import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(userId);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= 5) { // 5 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const userId = authHeader?.split(' ')[1] || 'anonymous';
    
    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        },
      });
    }

    const { description, category, title, severity, occurredAt, verification, sourceName, sourceDomain } = await req.json();

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

    const systemPrompt = `You write short, plain-language explanations for compliance/news events. Be factual, neutral, and concise. Include only what's in the provided content. Do not speculate. Use ISO dates (YYYY-MM-DD). No legal advice.`;

    const userPrompt = `SOURCE_META:
- source: ${sourceName || 'Unknown'} (${sourceDomain || 'unknown'})
- category: ${category || 'general'}
- severity: ${severity || 'not stated'}
- occurred_at: ${occurredAt || 'not stated'}
- verification: ${verification || 'unverified'}

EXTRACT:
${description}

TASK:
1) TL;DR (1–2 sentences, plain language).
2) What happened (3 bullets max).
3) Why it matters for ${category || 'consumers'} (2 bullets).
4) Key facts (amounts, penalties, recall class, parties) as short bullets.
5) 1 short direct quote from the source (≤ 25 words) suitable for users, or say "No direct quote available."

Rules:
- No speculation. If info isn't present, say "not stated."
- Use numbers with units (e.g., $95,000; Class II).
- Never give legal or medical advice.

Return a JSON object with: tldr, whatHappened (array), whyItMatters (array), keyFacts (array), quote (string).`;

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
        response_format: { type: "json_object" }
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', content);
      // Fallback to simple text
      return new Response(JSON.stringify({ 
        tldr: content,
        whatHappened: [],
        whyItMatters: [],
        keyFacts: [],
        quote: ''
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
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
