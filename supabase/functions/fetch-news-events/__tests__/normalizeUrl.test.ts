import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { normalizeUrl } from "../index.ts";

Deno.test("normalizeUrl strips utm params", () => {
  assertEquals(
    normalizeUrl("https://ex.com/a?utm_source=foo&utm_medium=bar"),
    "https://ex.com/a"
  );
});

Deno.test("normalizeUrl strips hash/anchors", () => {
  assertEquals(
    normalizeUrl("https://ex.com/a#section"),
    "https://ex.com/a"
  );
});

Deno.test("normalizeUrl removes trailing slash", () => {
  assertEquals(
    normalizeUrl("https://ex.com/a/"),
    "https://ex.com/a"
  );
});

Deno.test("normalizeUrl keeps meaningful query (we strip all by design)", () => {
  assertEquals(
    normalizeUrl("https://ex.com/a?ref=123"),
    "https://ex.com/a"
  );
});

Deno.test("normalizeUrl invalid URL returns input", () => {
  assertEquals(normalizeUrl("not a url"), "not a url");
});

Deno.test("normalizeUrl strips multiple query params and hash", () => {
  assertEquals(
    normalizeUrl("https://ex.com/article?utm_source=twitter&utm_campaign=spring#intro"),
    "https://ex.com/article"
  );
});

Deno.test("normalizeUrl converts hostname to lowercase", () => {
  assertEquals(
    normalizeUrl("https://Example.COM/Article"),
    "https://example.com/Article"
  );
});
