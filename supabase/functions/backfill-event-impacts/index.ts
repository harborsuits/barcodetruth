import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 15; // events per LLM call
const MAX_EVENTS = 200; // per invocation
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are an ethical impact classifier for consumer brands. Given news event descriptions, rate each event's impact on FOUR dimensions simultaneously.

Each dimension score must be an integer from -5 to +5:
- Negative = harmful to stakeholders in that dimension
- Positive = beneficial to stakeholders
- 0 = genuinely no relevance to this dimension

Dimensions:
- labor: Worker safety, wages, unionization, layoffs, working conditions, child labor, supply chain labor practices
- environment: Pollution, emissions, deforestation, sustainability, EPA violations, chemical spills, green initiatives
- politics: Lobbying, political donations, regulatory capture, government contracts, trade policy, antitrust
- social: Consumer safety, product recalls, discrimination, community impact, data privacy, public health, advertising ethics

CRITICAL RULES:
1. Most events affect MULTIPLE dimensions. A factory explosion = labor -4, environment -3. A product recall = social -3, labor -1.
2. Do NOT default to 0. If an event is about a brand, it almost certainly affects at least one dimension meaningfully.
3. Magnitude matters: minor issue = ±1, moderate = ±2-3, severe = ±4, critical = ±5.
4. The primary category should get the strongest score, but secondary dimensions should also get non-zero scores when relevant.
5. Be decisive. A pesticide contamination recall is social: -4, environment: -3, labor: -1. Not social: -1, everything else 0.`;

interface ClassifiedImpact {
  event_id: string;
  labor: number;
  environment: number;
  politics: number;
  social: number;
}

async function classifyBatch(
  events: { event_id: string; description: string; category: string }[],
  apiKey: string
): Promise<ClassifiedImpact[]> {
  const eventsText = events.map((e, i) =>
    `[${i}] id=${e.event_id} cat=${e.category}\n${e.description.slice(0, 300)}`
  ).join('\n\n');

  const response = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Classify these ${events.length} events:\n\n${eventsText}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "classify_impacts",
          description: "Classify ethical impact scores for brand events across all four dimensions",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    event_id: { type: "string" },
                    labor: { type: "integer", minimum: -5, maximum: 5 },
                    environment: { type: "integer", minimum: -5, maximum: 5 },
                    politics: { type: "integer", minimum: -5, maximum: 5 },
                    social: { type: "integer", minimum: -5, maximum: 5 },
                  },
                  required: ["event_id", "labor", "environment", "politics", "social"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify_impacts" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI gateway ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  const parsed = JSON.parse(toolCall.function.arguments);
  return (parsed.results || []).map((r: any) => ({
    event_id: r.event_id,
    labor: Math.max(-5, Math.min(5, Math.round(r.labor || 0))),
    environment: Math.max(-5, Math.min(5, Math.round(r.environment || 0))),
    politics: Math.max(-5, Math.min(5, Math.round(r.politics || 0))),
    social: Math.max(-5, Math.min(5, Math.round(r.social || 0))),
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { brandId, limit = MAX_EVENTS, dryRun = false, mode = "weak" } = await req.json().catch(() => ({}));

    // mode: "weak" = only events where 3+ dimensions are 0 (poorly classified)
    // mode: "all" = all non-irrelevant events
    let query = supabase
      .from('brand_events')
      .select('event_id, description, category, brand_id')
      .eq('is_irrelevant', false)
      .not('description', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (brandId) query = query.eq('brand_id', brandId);

    if (mode === "weak") {
      // Events not yet processed by the backfill pipeline
      query = query
        .or('ai_model_version.is.null,ai_model_version.not.ilike.%backfill%');
    }

    const { data: events, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No events need backfill', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[backfill-v2] Found ${events.length} events, mode=${mode}, dryRun=${dryRun}`);

    let processed = 0;
    let updated = 0;
    const errors: string[] = [];
    const sampleResults: ClassifiedImpact[] = [];

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE).filter(e => e.description);

      try {
        const results = await classifyBatch(
          batch.map(e => ({ event_id: e.event_id, description: e.description, category: e.category })),
          LOVABLE_API_KEY
        );

        if (sampleResults.length < 10) sampleResults.push(...results.slice(0, 10 - sampleResults.length));

        if (!dryRun) {
          for (const r of results) {
            const { error: updateError } = await supabase
              .from('brand_events')
              .update({
                impact_labor: r.labor,
                impact_environment: r.environment,
                impact_politics: r.politics,
                impact_social: r.social,
                category_impacts: { labor: r.labor, environment: r.environment, politics: r.politics, social: r.social },
                ai_model_version: 'gemini-2.5-flash-backfill-v2',
              })
              .eq('event_id', r.event_id);

            if (updateError) {
              errors.push(`${r.event_id}: ${updateError.message}`);
            } else {
              updated++;
            }
          }
        } else {
          updated += results.length;
        }
        processed += batch.length;

        // Rate limiting: 1.5s between batches
        if (i + BATCH_SIZE < events.length) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (batchErr: unknown) {
        const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
        errors.push(`Batch ${i}: ${msg}`);
        console.error(`[backfill-v2] Batch error:`, msg);
      }
    }

    // Compute stats from sample
    const multiDimCount = sampleResults.filter(r =>
      [r.labor, r.environment, r.politics, r.social].filter(v => v !== 0).length >= 2
    ).length;

    console.log(`[backfill-v2] Done: processed=${processed}, updated=${updated}, errors=${errors.length}, multiDim=${multiDimCount}/${sampleResults.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_found: events.length,
        processed,
        updated,
        dryRun,
        multiDimensionRate: sampleResults.length > 0 ? `${Math.round(multiDimCount / sampleResults.length * 100)}%` : 'N/A',
        sample: sampleResults.slice(0, 5),
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[backfill-v2] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
