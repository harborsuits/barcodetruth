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
    // Transliterate common accented chars before stripping
    .replace(/[éèêë]/g, 'e')
    .replace(/[àáâãä]/g, 'a')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .trim();

  // Check full-string acronym match first
  const acronymResult = ACRONYM_MAP[normalized];
  if (acronymResult) return acronymResult;

  const basicClean = normalized.replace(/[''`]/g, '').replace(/\s+/g, ' ').trim();
  const acronymResult2 = ACRONYM_MAP[basicClean];
  if (acronymResult2) return acronymResult2;

  // First pass: expand ONLY &-containing acronyms (e.g. "p&g" → "procter and gamble")
  // Must happen BEFORE & is replaced with "and"
  const preTokens = basicClean.split(/\s+/);
  const preExpanded = preTokens.map(t => (t.includes('&') && ACRONYM_MAP[t]) ? ACRONYM_MAP[t] : t);
  let working = preExpanded.join(' ');

  // Strip corporate suffixes and & → "and"
  let stripped = working
    .replace(/[&]/g, ' and ')
    .replace(SUFFIX_REGEX, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Second pass: expand remaining acronyms (ibm, ge, hp, etc.)
  // These expand AFTER suffix stripping so their expansions stay intact
  const tokens = stripped.split(/\s+/);
  const expanded = tokens.map(t => ACRONYM_MAP[t] || t);
  normalized = expanded.join(' ');

  // Final cleanup + deduplicate consecutive repeated words
  normalized = normalized
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(\w+)(\s+\1)+\b/g, '$1');

  return normalized;
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
  companyId: string | null;
}

interface AliasEntry {
  brandId: string;
  externalName: string;
  normalized: string;
}

interface CompanyEntry {
  id: string;
  name: string;
  normalized: string;
  parentCompanyId: string | null;
  legalName: string | null;
  legalNormalized: string | null;
  brandIds: string[]; // brands linked to this company
}

let brandCache: BrandEntry[] = [];
let aliasCache: AliasEntry[] = [];
let companyCache: CompanyEntry[] = [];
let cacheLoaded = false;

/**
 * Load brand + alias + company data into memory for fast matching.
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
    companyId: null, // populated below via ownership
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

  // Load companies (the corporate entity graph)
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, normalized_name, parent_company_id, legal_name')
    .limit(5000);

  // Load brand→company links via company_ownership
  const { data: ownership } = await supabase
    .from('company_ownership')
    .select('child_brand_id, parent_company_id')
    .not('child_brand_id', 'is', null)
    .not('parent_company_id', 'is', null)
    .limit(10000);

  // Build company→brand mapping
  const companyBrandMap = new Map<string, string[]>();
  for (const o of (ownership || [])) {
    if (!o.parent_company_id || !o.child_brand_id) continue;
    const list = companyBrandMap.get(o.parent_company_id) || [];
    list.push(o.child_brand_id);
    companyBrandMap.set(o.parent_company_id, list);
    // Also set companyId on brand
    const brand = brandCache.find(b => b.id === o.child_brand_id);
    if (brand) brand.companyId = o.parent_company_id;
  }

  companyCache = (companies || []).map(c => ({
    id: c.id,
    name: c.name,
    normalized: c.normalized_name || normalizeFirmName(c.name),
    parentCompanyId: c.parent_company_id,
    legalName: c.legal_name,
    legalNormalized: c.legal_name ? normalizeFirmName(c.legal_name) : null,
    brandIds: companyBrandMap.get(c.id) || [],
  }));

  cacheLoaded = true;
  console.log(`[matcher] Cache loaded: ${brandCache.length} brands, ${aliasCache.length} aliases, ${companyCache.length} companies`);
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

  // 3. Company entity match (corporate hierarchy resolution)
  // Try: firm name → company → brands linked to that company
  const companyMatch = companyCache.find(c => c.normalized === norm || c.legalNormalized === norm);
  if (companyMatch && companyMatch.brandIds.length > 0) {
    const primaryBrand = brandCache.find(b => b.id === companyMatch.brandIds[0]);
    if (primaryBrand) {
      return {
        brandId: primaryBrand.id,
        brandName: primaryBrand.name,
        confidence: 'parent',
        score: 0.95,
        matchedVia: `company: ${companyMatch.name}`,
      };
    }
  }

  // 3b. Walk up the company hierarchy: firm → subsidiary company → parent company → brands
  if (companyMatch && companyMatch.parentCompanyId) {
    const parentCo = companyCache.find(c => c.id === companyMatch.parentCompanyId);
    if (parentCo && parentCo.brandIds.length > 0) {
      const primaryBrand = brandCache.find(b => b.id === parentCo.brandIds[0]);
      if (primaryBrand) {
        return {
          brandId: primaryBrand.id,
          brandName: primaryBrand.name,
          confidence: 'parent',
          score: 0.9,
          matchedVia: `subsidiary ${companyMatch.name} → parent ${parentCo.name}`,
        };
      }
    }
  }

  // 3c. Legacy: Parent company string match on brands
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

  // 3d. Check if firm name IS a parent company of multiple brands
  const childBrands = brandCache.filter(b => b.parentNormalized === norm);
  if (childBrands.length > 0) {
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
