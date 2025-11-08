/**
 * Fetch with exponential backoff and jitter for handling transient failures
 */
export async function fetchWithBackoff(
  url: string,
  init: RequestInit = {},
  opts = { tries: 5, baseMs: 400, timeoutMs: 10000 }
) {
  let lastErr: unknown;
  
  for (let i = 0; i < opts.tries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
    
    try {
      const res = await fetch(url, { 
        ...init, 
        redirect: "follow",
        signal: controller.signal 
      });
      
      clearTimeout(timeout);
      
      // Retry on 429/5xx
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`HTTP_${res.status}`);
      }
      
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      
      // Don't retry on last attempt
      if (i === opts.tries - 1) break;
      
      // Exponential backoff + jitter
      const delay = Math.round((opts.baseMs * 2 ** i) + Math.random() * 150);
      console.log(`[http] Retry ${i + 1}/${opts.tries} after ${delay}ms`, err);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastErr;
}
