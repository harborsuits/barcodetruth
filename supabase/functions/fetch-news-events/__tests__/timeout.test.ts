import { assertRejects } from "https://deno.land/std/testing/asserts.ts";

// Inline if not exported
const fetchWithTimeout = (url: string, timeoutMs = 100, init?: RequestInit) => {
  return Promise.race([
    fetch(url, init),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]) as Promise<Response>;
};

Deno.test("fetchWithTimeout resolves quickly when fetch returns promptly", async () => {
  // Test with a real fast endpoint (httpbin returns quickly)
  const res = await fetchWithTimeout("https://httpbin.org/status/200", 5000);
  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }
});

Deno.test("fetchWithTimeout rejects on timeout", async () => {
  // Use a delayed endpoint that will timeout
  await assertRejects(
    async () => {
      // httpbin delay endpoint - ask for 2 second delay but timeout at 100ms
      await fetchWithTimeout("https://httpbin.org/delay/2", 100);
    },
    Error,
    "Timeout after 100ms"
  );
});
