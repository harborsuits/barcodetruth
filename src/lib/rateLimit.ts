// Simple in-memory rate limiter for edge functions
// Bucket refills at a constant rate

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  identifier: string,
  maxTokens: number = 30,
  refillMs: number = 60_000
): boolean {
  const now = Date.now();
  const bucket = buckets.get(identifier) ?? { tokens: maxTokens, lastRefill: now };

  // Calculate refill
  const timePassed = now - bucket.lastRefill;
  const refillAmount = Math.floor(timePassed / refillMs) * maxTokens;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + refillAmount);
  bucket.lastRefill = now;

  // Check if tokens available
  if (bucket.tokens <= 0) {
    buckets.set(identifier, bucket);
    return false;
  }

  // Consume token
  bucket.tokens--;
  buckets.set(identifier, bucket);
  return true;
}

export function getRateLimitHeaders(remaining: number, limit: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, remaining).toString(),
    'X-RateLimit-Reset': new Date(Date.now() + 60_000).toISOString(),
  };
}
