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
 * Check if we have budget remaining for this source in the current 24h window
 */
async function checkBudget(
  supabase: SupabaseClient,
  sourceId: SourceId
): Promise<BudgetCheckResult> {
  const config = getSourceConfig(sourceId);
  if (!config) {
    return { allowed: false, remaining: 0, resetAt: new Date(), reason: 'unknown_source' };
  }

  // Calculate current 24h window (UTC midnight to midnight)
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCHours(0, 0, 0, 0);

  // Fetch current usage for this source in current window
  const { data, error } = await supabase
    .from('api_rate_limits')
    .select('call_count, window_start')
    .eq('source', sourceId)
    .gte('window_start', windowStart.toISOString())
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows (ok)
    console.error(`[fetchBudgeted] Error checking budget for ${sourceId}:`, error);
    return { allowed: true, remaining: config.dailyLimit, resetAt: windowStart }; // fail open
  }

  const currentCount = data?.call_count ?? 0;
  const remaining = Math.max(0, config.dailyLimit - currentCount);
  
  const resetAt = new Date(windowStart);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1); // next midnight UTC

  if (remaining <= 0) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt,
      reason: `quota_exhausted (${currentCount}/${config.dailyLimit})`
    };
  }

  return { allowed: true, remaining, resetAt };
}

/**
 * Increment the call counter for this source
 */
async function incrementUsage(
  supabase: SupabaseClient,
  sourceId: SourceId
): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCHours(0, 0, 0, 0);

  // Use the RPC function to increment atomically
  const { error } = await supabase.rpc('increment_rate_limit', { 
    p_source: sourceId,
    p_window_start: windowStart.toISOString()
  });

  if (error) {
    console.error(`[fetchBudgeted] Error incrementing usage for ${sourceId}:`, error);
  }
}

/**
 * Budget-aware fetch wrapper
 * - Checks api_rate_limits before making the request
 * - Skips if budget exhausted (returns null response)
 * - Increments counter on successful check
 * - Handles errors gracefully (logs + returns error response)
 */
export async function fetchBudgeted(
  supabase: SupabaseClient,
  sourceId: SourceId,
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Check budget
  const budget = await checkBudget(supabase, sourceId);
  
  if (!budget.allowed) {
    console.warn(`[fetchBudgeted] ${sourceId} budget exhausted: ${budget.reason}`);
    return new Response(JSON.stringify({ 
      error: 'quota_exceeded', 
      source: sourceId,
      resetAt: budget.resetAt 
    }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`[fetchBudgeted] ${sourceId} - ${budget.remaining} calls remaining until ${budget.resetAt.toISOString()}`);

  // Make the request
  try {
    await incrementUsage(supabase, sourceId);
    const response = await fetch(url, options);
    
    // Log non-200 responses
    if (!response.ok) {
      console.warn(`[fetchBudgeted] ${sourceId} returned ${response.status} for: ${url.slice(0, 100)}`);
    }
    
    return response;
  } catch (err) {
    console.error(`[fetchBudgeted] ${sourceId} fetch failed:`, err);
    return new Response(JSON.stringify({ error: 'fetch_failed', message: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
