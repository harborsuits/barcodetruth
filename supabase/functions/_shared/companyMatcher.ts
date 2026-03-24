/**
 * Company Name Resolution Layer
 * 
 * Resolves messy firm names from regulatory datasets to canonical brand_ids.
 * 
 * Resolution priority:
 *   1. Exact brand name match (normalized)
 *   2. Alias table lookup
 *   3. Parent company match → child brands
 *   4. Fuzzy similarity (trigram-style)
 *   5. Reject / queue for review
 * 
 * Examples:
 *   "FRITO-LAY NORTH AMERICA INC" → Doritos (via parent PepsiCo)
 *   "Procter & Gamble Company"    → P&G (via alias)
 *   "NESTLÉ PURINA PETCARE CO"    → Nestlé (via normalized match)
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Corporate suffixes to strip ────────────────────────────────────────

// ── Acronym expansion map ──────────────────────────────────────────────

const ACRONYM_MAP: Record<string, string> = {
  'p&g': 'procter and gamble',
  'p & g': 'procter and gamble',
  'pg': 'procter and gamble',
  'j&j': 'johnson and johnson',
  'j & j': 'johnson and johnson',
  'jnj': 'johnson and johnson',
  'khc': 'kraft heinz',
  'gm': 'general motors',
  'ge': 'general electric',
  'ibm': 'international business machines',
  'hp': 'hewlett packard',
  'hpe': 'hewlett packard enterprise',
  'jbs': 'jbs',
  'lg': 'lg electronics',
  'bp': 'bp',
  'vw': 'volkswagen',
  'bmw': 'bayerische motoren werke',
  'lvmh': 'lvmh moet hennessy louis vuitton',
  'ab inbev': 'anheuser busch inbev',
  'abi': 'anheuser busch inbev',
  '3m': 'minnesota mining and manufacturing',
  'at&t': 'american telephone and telegraph',
  'at & t': 'american telephone and telegraph',
};

const CORP_SUFFIXES = [
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company',
  'llc', 'llp', 'ltd', 'limited', 'plc', 'ag', 'sa', 'gmbh',
  'nv', 'bv', 'se', 'spa', 'srl', 'pty', 'pvt',
  'north america', 'usa', 'us', 'americas', 'international', 'global',
  'holdings', 'group', 'enterprises', 'industries',
  'of america', 'the',
];

const SUFFIX_REGEX = new RegExp(
  `\\b(${CORP_SUFFIXES.join('|')})\\b\\.?`,
  'gi'
);

/**
 * Normalize a company/firm name for matching.
 * Expands acronyms, strips corporate suffixes, punctuation, extra whitespace.
 */
export function normalizeFirmName(name: string): string {
  let normalized = name
    .normalize('NFC')
    .toLowerCase()
    .trim();

  // Check acronym map before stripping punctuation (preserves & in P&G etc.)
  const acronymResult = ACRONYM_MAP[normalized];
  if (acronymResult) return acronymResult;

  // Also check after basic cleanup
  const basicClean = normalized.replace(/[''`]/g, '').replace(/\s+/g, ' ').trim();
  const acronymResult2 = ACRONYM_MAP[basicClean];
  if (acronymResult2) return acronymResult2;

  return normalized
    .replace(/[''`]/g, '')        // smart quotes
    .replace(/[&]/g, ' and ')     // & → and
    .replace(SUFFIX_REGEX, '')    // strip corp suffixes
    .replace(/[^a-z0-9\s]/g, '') // remove remaining punctuation
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim();
}

/**
 * Simple bigram similarity (0-1 range).
 * Fast approximation of trigram similarity for Deno context.
 */
function bigrams(str: string): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    s.add(str.substring(i, i + 2));
  }
  return s;
}

export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  let intersection = 0;
  for (const g of aGrams) {
    if (bGrams.has(g)) intersection++;
  }
  return (2 * intersection) / (aGrams.size + bGrams.size);
}

// ── Match result types ─────────────────────────────────────────────────

export type MatchConfidence = 'exact' | 'alias' | 'parent' | 'fuzzy' | 'none';

export interface BrandMatch {
  brandId: string;
  brandName: string;
  confidence: MatchConfidence;
  score: number; // 0-1 similarity score
  matchedVia: string; // what matched (e.g. "alias: P&G", "parent: PepsiCo")
}

// ── In-memory cache ────────────────────────────────────────────────────

interface BrandEntry {
  id: string;
  name: string;
  normalized: string;
  parentCompany: string | null;
  parentNormalized: string | null;
}

interface AliasEntry {
  brandId: string;
  externalName: string;
  normalized: string;
}

let brandCache: BrandEntry[] = [];
let aliasCache: AliasEntry[] = [];
let cacheLoaded = false;

/**
 * Load brand + alias data into memory for fast matching.
 * Call once per edge function invocation.
 */
export async function loadMatchCache(supabase: SupabaseClient): Promise<void> {
  if (cacheLoaded) return;

  // Load all brands (name + parent)
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, parent_company')
    .limit(5000);

  brandCache = (brands || []).map(b => ({
    id: b.id,
    name: b.name,
    normalized: normalizeFirmName(b.name),
    parentCompany: b.parent_company,
    parentNormalized: b.parent_company ? normalizeFirmName(b.parent_company) : null,
  }));

  // Load all aliases
  const { data: aliases } = await supabase
    .from('brand_aliases')
    .select('canonical_brand_id, external_name')
    .limit(10000);

  aliasCache = (aliases || []).map(a => ({
    brandId: a.canonical_brand_id,
    externalName: a.external_name,
    normalized: normalizeFirmName(a.external_name),
  }));

  cacheLoaded = true;
  console.log(`[matcher] Cache loaded: ${brandCache.length} brands, ${aliasCache.length} aliases`);
}

/**
 * Resolve a firm name to a brand.
 * Returns the best match with confidence level, or null if no match found.
 */
export function matchFirmToBrand(firmName: string): BrandMatch | null {
  const norm = normalizeFirmName(firmName);
  if (!norm) return null;

  // 1. Exact brand name match
  const exactBrand = brandCache.find(b => b.normalized === norm);
  if (exactBrand) {
    return {
      brandId: exactBrand.id,
      brandName: exactBrand.name,
      confidence: 'exact',
      score: 1.0,
      matchedVia: `exact: ${exactBrand.name}`,
    };
  }

  // 2. Alias table lookup
  const aliasMatch = aliasCache.find(a => a.normalized === norm);
  if (aliasMatch) {
    const brand = brandCache.find(b => b.id === aliasMatch.brandId);
    return {
      brandId: aliasMatch.brandId,
      brandName: brand?.name || aliasMatch.externalName,
      confidence: 'alias',
      score: 1.0,
      matchedVia: `alias: ${aliasMatch.externalName}`,
    };
  }

  // 3. Parent company match → return parent brand
  const parentMatch = brandCache.find(b => b.parentNormalized === norm);
  if (parentMatch) {
    return {
      brandId: parentMatch.id,
      brandName: parentMatch.name,
      confidence: 'parent',
      score: 0.9,
      matchedVia: `parent: ${parentMatch.parentCompany}`,
    };
  }

  // 3b. Check if firm name IS a parent company of multiple brands
  const childBrands = brandCache.filter(b => b.parentNormalized === norm);
  if (childBrands.length > 0) {
    // Return the parent itself if it exists as a brand
    const parentBrand = brandCache.find(b => b.normalized === norm);
    if (parentBrand) {
      return {
        brandId: parentBrand.id,
        brandName: parentBrand.name,
        confidence: 'exact',
        score: 1.0,
        matchedVia: `parent brand: ${parentBrand.name}`,
      };
    }
  }

  // 4. Fuzzy matching
  const FUZZY_THRESHOLD = norm.length < 6 ? 0.75 : 0.6;
  let bestMatch: BrandMatch | null = null;
  let bestScore = 0;

  // Check brands
  for (const brand of brandCache) {
    const sim = similarity(norm, brand.normalized);
    if (sim > bestScore && sim >= FUZZY_THRESHOLD) {
      bestScore = sim;
      bestMatch = {
        brandId: brand.id,
        brandName: brand.name,
        confidence: 'fuzzy',
        score: sim,
        matchedVia: `fuzzy: "${brand.name}" (${(sim * 100).toFixed(0)}%)`,
      };
    }
  }

  // Check aliases too
  for (const alias of aliasCache) {
    const sim = similarity(norm, alias.normalized);
    if (sim > bestScore && sim >= FUZZY_THRESHOLD) {
      bestScore = sim;
      const brand = brandCache.find(b => b.id === alias.brandId);
      bestMatch = {
        brandId: alias.brandId,
        brandName: brand?.name || alias.externalName,
        confidence: 'fuzzy',
        score: sim,
        matchedVia: `fuzzy alias: "${alias.externalName}" (${(sim * 100).toFixed(0)}%)`,
      };
    }
  }

  // 4b. Also try matching against parent company names
  if (!bestMatch || bestScore < 0.8) {
    for (const brand of brandCache) {
      if (!brand.parentNormalized) continue;
      const sim = similarity(norm, brand.parentNormalized);
      if (sim > bestScore && sim >= FUZZY_THRESHOLD) {
        bestScore = sim;
        bestMatch = {
          brandId: brand.id,
          brandName: brand.name,
          confidence: 'fuzzy',
          score: sim,
          matchedVia: `fuzzy parent: "${brand.parentCompany}" (${(sim * 100).toFixed(0)}%)`,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Batch resolve multiple firm names.
 * Returns a map of firmName → BrandMatch (or null).
 */
export function matchFirmsBatch(firmNames: string[]): Map<string, BrandMatch | null> {
  const results = new Map<string, BrandMatch | null>();
  for (const name of firmNames) {
    results.set(name, matchFirmToBrand(name));
  }
  return results;
}

/**
 * High-confidence match only (exact, alias, or parent).
 * Returns null for fuzzy matches — those should go to review.
 */
export function matchFirmHighConfidence(firmName: string): BrandMatch | null {
  const match = matchFirmToBrand(firmName);
  if (!match) return null;
  if (match.confidence === 'fuzzy' && match.score < 0.85) return null;
  return match;
}
