import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      brandName,
      category,
      articleTitle,
      articleSnippet,
      source,
      fineAmount,
      severity,
      date
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build context for the AI
    const context = [
      `Brand: ${brandName}`,
      `Category: ${category}`,
      articleTitle ? `Headline: ${articleTitle}` : null,
      articleSnippet ? `Details: ${articleSnippet}` : null,
      source ? `Source: ${source}` : null,
      fineAmount ? `Fine: $${fineAmount.toLocaleString()}` : null,
      severity ? `Severity: ${severity}` : null,
      date ? `Date: ${new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : null,
    ].filter(Boolean).join('\n');

    const prompt = `Summarize this brand accountability event in ONE clear sentence that normal people understand.

${context}

Rules:
- Start with "According to [source]" if available
- Include the brand name, what happened, and the outcome
- Mention fine amounts if significant
- Keep it factual and neutral
- Make it readable for consumers, not lawyers
- One sentence only

Example: "According to Reuters, Nestlé was fined $28,000 by OSHA in January 2025 after workers were exposed to unsafe ammonia levels."`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are a fact-based summarizer that creates clear, consumer-friendly summaries of brand accountability events. Be precise and neutral." 
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content || "No summary available";

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating summary:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate summary";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
