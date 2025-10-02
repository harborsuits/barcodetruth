import { assertEquals, assertRejects } from "https://deno.land/std/testing/asserts.ts";
import { fetchWithTimeout } from "../index.ts";

Deno.test("fetchWithTimeout resolves quickly when fetch returns promptly", async () => {
  // Mock fetch to return immediately
  const originalFetch = globalThis.fetch;
  const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
  globalThis.fetch = () => Promise.resolve(mockResponse);

  try {
    const res = await fetchWithTimeout("https://example.com/fast", 5000);
    assertEquals(res.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("fetchWithTimeout rejects on timeout", async () => {
  // Mock fetch to never resolve (simulates hanging connection)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {}); // Never resolves

  try {
    await assertRejects(
      async () => {
        await fetchWithTimeout("https://example.com/hang", 50);
      },
      Error,
      "Timeout after 50ms"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
