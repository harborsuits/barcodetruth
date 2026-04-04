/**
 * LLM-powered event classifier for Barcode Truth
 * 
 * Replaces keyword-based ±1 scoring with nuanced LLM impact assessment.
 * Uses Lovable AI gateway (Gemini Flash) for cost efficiency.
 * 
 * Accepts: { event_id } or { batch: true, limit: 50 }
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { passesFinancialBlocklist, validateBrandAttribution } from '../_shared/ingestionGate.ts';

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const SYSTEM_PROMPT = `You are evaluating news events for an ethical consumer app called Barcode Truth. Your job is to determine if a news article reveals how a company treats its workers, suppliers, communities, or environment — including through financial decisions that directly affect them (e.g. wage gaps, profit-during-layoffs, executive pay vs worker pay).

You must respond with ONLY valid JSON matching this schema:
{
  "relevant": boolean,
  "dimension": "labor" | "environment" | "social" | "politics" | "none",
  "impact_score": integer from -10 to +10,
  "severity": "minor" | "moderate" | "severe",
  "reasoning": "one sentence explaining the score"
}

Impact score guidelines:
- Regulatory fine/penalty: -5 to -8
- Lawsuit settled: -4 to -7
- Lawsuit filed (unresolved): -2 to -4
- Certification achieved (B-Corp, Fair Trade): +4 to +7
- Verified wage increase: +3 to +5
- Executive pay gap story: -3 to -5
- Layoffs during profit growth: -4 to -6
- Environmental violation/spill: -5 to -9
- Community investment with severance: +2 to +4
- Recall/safety failure: -3 to -6
- Minor positive/negative news: ±1 to ±2

If the article is pure financial reporting (earnings, stock price, analyst ratings) with no worker/community/environment angle, set relevant=false and impact_score=0.`;

interface ClassifyResult {
  relevant: boolean;
  dimension: string;
  impact_score: number;
  severity: string;
  reasoning: string;
}

async function classifyWithLLM(
  title: string,
  description: string,
  brandName: string,
  apiKey: string
): Promise<ClassifyResult> {
  const userPrompt = `Brand: ${brandName}
Title: ${title}
Description: ${description}

Does this reveal how ${brandName} treats its workers, suppliers, communities, or environment?`;

  const response = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'classify_event',
          description: 'Classify a news event for ethical consumer scoring',
          parameters: {
            type: 'object',
            properties: {
              relevant: { type: 'boolean' },
              dimension: { type: 'string', enum: ['labor', 'environment', 'social', 'politics', 'none'] },
              impact_score: { type: 'integer', minimum: -10, maximum: 10 },
              severity: { type: 'string', enum: ['minor', 'moderate', 'severe'] },
              reasoning: { type: 'string' },
            },
            required: ['relevant', 'dimension', 'impact_score', 'severity', 'reasoning'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'classify_event' } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI gateway ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error('No tool call in AI response');
  }

  const args = typeof toolCall.function.arguments === 'string'
    ? JSON.parse(toolCall.function.arguments)
    : toolCall.function.arguments;

  // Clamp impact score to DB constraint range (-10 to +10)
  args.impact_score = Math.max(-10, Math.min(10, args.impact_score));

  return args as ClassifyResult;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { event_id, batch = false, limit = 50, dryRun = false } = body;

    let events: any[];

    if (event_id) {
      // Single event mode
      const { data, error } = await supabase
        .from('brand_events')
        .select('event_id, brand_id, title, description, article_text, source_url, brands!inner(name)')
        .eq('event_id', event_id)
        .single();
      if (error) throw error;
      events = [data];
    } else if (batch) {
      // Batch mode: find events that haven't been LLM-classified yet
      // Look for events where ai_model_version is null (not yet LLM-classified)
      const { data, error } = await supabase
        .from('brand_events')
        .select('event_id, brand_id, title, description, article_text, source_url, brands!inner(name)')
        .is('ai_model_version', null)
        .eq('is_test', false)
        .not('title', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      events = data || [];
    } else {
      return new Response(JSON.stringify({ error: 'Provide event_id or batch=true' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[classify-event] Processing ${events.length} events`);

    let classified = 0;
    let blocked = 0;
    let failed = 0;
    const results: any[] = [];

    for (const event of events) {
      try {
        const brandName = (event.brands as any)?.name || 'Unknown';
        const title = event.title || '';
        const description = event.description || '';

        // Stage 1: Fast financial blocklist
        const gateResult = passesFinancialBlocklist(title, description);
        if (!gateResult.pass) {
          blocked++;
          if (!dryRun) {
            await supabase
              .from('brand_events')
              .update({
                score_eligible: false,
                is_irrelevant: true,
                noise_reason: gateResult.reason,
                ai_model_version: 'gate-blocklist-v1',
              })
              .eq('event_id', event.event_id);
          }
          results.push({ event_id: event.event_id, status: 'blocked', reason: gateResult.reason });
          continue;
        }

        // Stage 2: LLM classification
        const classification = await classifyWithLLM(title, description, brandName, apiKey);

        // Map dimension to impact columns
        const dimensionMap: Record<string, string> = {
          labor: 'impact_labor',
          environment: 'impact_environment',
          social: 'impact_social',
          politics: 'impact_politics',
        };

        const impacts: Record<string, number> = {
          impact_labor: 0,
          impact_environment: 0,
          impact_politics: 0,
          impact_social: 0,
        };

        if (classification.relevant && classification.dimension !== 'none') {
          const impactCol = dimensionMap[classification.dimension];
          if (impactCol) {
            // Clamp to DB constraint (-5 to +5 for individual columns)
            impacts[impactCol] = Math.max(-5, Math.min(5, classification.impact_score));
          }
        }

        const categoryImpacts = {
          labor: impacts.impact_labor,
          environment: impacts.impact_environment,
          politics: impacts.impact_politics,
          social: impacts.impact_social,
        };

        const orientation = classification.impact_score > 0 ? 'positive'
          : classification.impact_score < 0 ? 'negative' : 'mixed';

        const update = {
          ...impacts,
          category_impacts: categoryImpacts,
          category: classification.dimension === 'none' ? 'social' : classification.dimension,
          orientation,
          severity: classification.severity,
          relevance_reason: classification.reasoning,
          ai_model_version: 'gemini-2.5-flash-lite-v1',
          ai_summary: classification.reasoning,
          score_eligible: classification.relevant && Math.abs(classification.impact_score) >= 2,
          feed_visible: classification.relevant,
          is_irrelevant: !classification.relevant,
          noise_reason: !classification.relevant ? 'LLM classified as not ethically relevant' : null,
        };

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('brand_events')
            .update(update)
            .eq('event_id', event.event_id);
          if (updateError) throw updateError;
        }

        classified++;
        results.push({
          event_id: event.event_id,
          status: 'classified',
          brand: brandName,
          title: title.slice(0, 80),
          ...classification,
        });

        // Rate limit: ~200ms between calls
        if (events.length > 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        failed++;
        console.error(`[classify-event] Failed ${event.event_id}:`, err);
        results.push({ event_id: event.event_id, status: 'error', error: String(err) });
      }
    }

    console.log(`[classify-event] Done: classified=${classified}, blocked=${blocked}, failed=${failed}`);

    return new Response(JSON.stringify({
      processed: events.length,
      classified,
      blocked,
      failed,
      results: results.slice(0, 20), // Cap response size
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[classify-event] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
