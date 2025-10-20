// Budget-aware fetch wrapper that enforces api_rate_limits
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSourceConfig, SourceId } from "./sourceRegistry.ts";

interface BudgetCheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
}

/**
 * Check budget using try_spend RPC - atomically checks and increments if allowed
 */
async function checkBudget(
  supabase: SupabaseClient,
  sourceId: SourceId
): Promise<BudgetCheckResult> {
  const config = getSourceConfig(sourceId);
  if (!config) {
    return { allowed: false, remaining: 0, resetAt: new Date(), reason: 'unknown_source' };
  }

  // Call try_spend RPC which atomically checks budget and increments
  const { data: allowed, error } = await supabase.rpc('try_spend', { 
    p_source: sourceId,
    p_cost: 1 
  });

  if (error) {
    console.error(`[fetchBudgeted] Error checking budget for ${sourceId}:`, error);
    return { allowed: true, remaining: config.dailyLimit, resetAt: new Date() }; // fail open
  }

  if (!allowed) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt: new Date(Date.now() + 86400000), // ~24h from now
      reason: `quota_exhausted`
    };
  }

  // If allowed, fetch remaining count for logging
  const { data: configData } = await supabase
    .from('api_rate_config')
    .select('limit_per_window')
    .eq('source', sourceId)
    .single();

  const { data: usageData } = await supabase
    .from('api_rate_limits')
    .select('call_count')
    .eq('source', sourceId)
    .order('window_start', { ascending: false })
    .limit(1)
    .single();

  const remaining = Math.max(0, (configData?.limit_per_window ?? config.dailyLimit) - (usageData?.call_count ?? 0));
  
  return { 
    allowed: true, 
    remaining, 
    resetAt: new Date(Date.now() + 86400000)
  };
}

/**
 * Log API errors for visibility
 */
async function logApiError(
  supabase: SupabaseClient,
  sourceId: SourceId,
  status: number,
  message: string
): Promise<void> {
  await supabase.from('api_error_log').insert({
    source: sourceId,
    status,
    message: message.slice(0, 500) // truncate
  });
}

/**
 * Budget-aware fetch wrapper
 * - Calls try_spend() to atomically check + increment budget
 * - Skips if budget exhausted (returns 429 response)
 * - Logs errors for visibility
 * - Handles errors gracefully (logs + returns error response)
 */
export async function fetchBudgeted(
  supabase: SupabaseClient,
  sourceId: SourceId,
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Check budget (also increments if allowed)
  const budget = await checkBudget(supabase, sourceId);
  
  if (!budget.allowed) {
    console.warn(`[fetchBudgeted] ${sourceId} budget exhausted: ${budget.reason}`);
    await logApiError(supabase, sourceId, 429, budget.reason || 'quota_exceeded');
    return new Response(JSON.stringify({ 
      error: 'quota_exceeded', 
      source: sourceId,
      resetAt: budget.resetAt 
    }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`[fetchBudgeted] ${sourceId} - ${budget.remaining} calls remaining`);

  // Make the request
  try {
    const response = await fetch(url, options);
    
    // Log non-200 responses
    if (!response.ok) {
      const msg = `HTTP ${response.status} for ${url.slice(0, 100)}`;
      console.warn(`[fetchBudgeted] ${sourceId}: ${msg}`);
      await logApiError(supabase, sourceId, response.status, msg);
    }
    
    return response;
  } catch (err) {
    const msg = String(err);
    console.error(`[fetchBudgeted] ${sourceId} fetch failed:`, msg);
    await logApiError(supabase, sourceId, 0, msg);
    return new Response(JSON.stringify({ error: 'fetch_failed', message: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
