/**
 * Unified Regulatory Ingestion Pipeline
 * 
 * Two modes:
 *   1. Brand-targeted: Run adapters with brand name as search query
 *   2. Discovery: Fetch recent records broadly, resolve firm names to brands via matcher
 * 
 * Pipeline: source adapter → normalize → match brand → dedupe → insert event
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { RELEVANCE_MAX_SCORE } from "./scoringConstants.ts";
import {
  loadMatchCache,
  matchFirmToBrand,
  matchFirmHighConfidence,
  normalizeFirmName,
  type BrandMatch,
} from "./companyMatcher.ts";

// ── Types ──────────────────────────────────────────────────────────────

export interface RawRegRecord {
  sourceId: string;
  title: string;
  description: string;
  firmName: string;
  date: string;
  sourceUrl: string;
  category: 'labor' | 'environment' | 'social' | 'politics';
  impact: number;
  sourceName: string;
  sourceDomain: string;
  agencyFullName: string;
  rawData?: Record<string, unknown>;
}

export interface SourceAdapter {
  id: string;
  featureFlagKey: string;
  fetch(query: string, maxResults: number): Promise<RawRegRecord[]>;
}

export interface PipelineResult {
  source: string;
  brandName: string;
  scanned: number;
  inserted: number;
  skipped: number;
  errors: number;
  queued_for_review: number;
}

export interface DiscoveryResult {
  source: string;
  totalRecords: number;
  matched: number;
  inserted: number;
  queued: number;
  noMatch: number;
}

// ── Brand Resolution ───────────────────────────────────────────────────

export async function resolveBrandQueries(
  supabase: SupabaseClient,
  brandId: string
): Promise<{ name: string; queries: string[] } | null> {
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, parent_company')
    .eq('id', brandId)
    .maybeSingle();

  if (!brand) return null;

  const queries: string[] = [brand.name];
  if (brand.parent_company && brand.parent_company !== brand.name) {
    queries.push(brand.parent_company);
  }

  const { data: aliases } = await supabase
    .from('brand_aliases')
    .select('external_name')
    .eq('canonical_brand_id', brandId)
    .limit(5);

  if (aliases) {
    for (const a of aliases) {
      if (a.external_name && !queries.includes(a.external_name)) {
        queries.push(a.external_name);
      }
    }
  }

  return { name: brand.name, queries };
}

// ── Deduplication ──────────────────────────────────────────────────────

async function isDuplicate(supabase: SupabaseClient, sourceUrl: string): Promise<boolean> {
  const { data } = await supabase
    .from('brand_events')
    .select('event_id')
    .eq('source_url', sourceUrl)
    .maybeSingle();
  return !!data;
}

// ── Event Insertion ────────────────────────────────────────────────────

async function insertEvent(
  supabase: SupabaseClient,
  brandId: string,
  record: RawRegRecord,
): Promise<string | null> {
  const uniqueUrl = `${record.sourceUrl}#${record.sourceId}`;

  if (await isDuplicate(supabase, uniqueUrl)) return null;

  const { data: newEvent, error } = await supabase
    .from('brand_events')
    .insert({
      brand_id: brandId,
      category: record.category,
      verification: 'official',
      orientation: 'negative',
      title: record.title.substring(0, 500),
      description: record.description.substring(0, 2000),
      source_url: uniqueUrl,
      relevance_score_raw: RELEVANCE_MAX_SCORE,
      is_irrelevant: false,
      event_date: record.date,
      [`impact_${record.category}`]: record.impact,
      raw_data: record.rawData ? JSON.parse(JSON.stringify(record.rawData)) : null,
    })
    .select('event_id')
    .single();

  if (error) {
    if (error.code === '23505') return null;
    console.error(`[pipeline] Insert error for ${record.sourceId}:`, error.message);
    return null;
  }

  const safeTitle = `${record.sourceName}: ${record.title.substring(0, 100)}`;
  await supabase
    .from('event_sources')
    .upsert(
      {
        event_id: newEvent.event_id,
        source_name: record.sourceName,
        title: safeTitle.length >= 4 ? safeTitle : `${record.sourceName} record`,
        source_url: uniqueUrl,
        canonical_url: uniqueUrl,
        domain_owner: record.agencyFullName,
        registrable_domain: record.sourceDomain,
        domain_kind: 'official',
        source_date: record.date,
        is_primary: true,
        link_kind: 'database',
        article_snippet: record.description.substring(0, 300),
      },
      { onConflict: 'event_id,source_url', ignoreDuplicates: true }
    );

  return newEvent.event_id;
}

// ── Queue for Review ───────────────────────────────────────────────────

async function queueForReview(
  supabase: SupabaseClient,
  record: RawRegRecord,
  adapterId: string,
  match: BrandMatch | null,
): Promise<void> {
  await supabase
    .from('regulatory_match_review')
    .upsert(
      {
        firm_name: record.firmName,
        normalized_firm: normalizeFirmName(record.firmName),
        source_adapter: adapterId,
        source_record_id: record.sourceId,
        suggested_brand_id: match?.brandId || null,
        suggested_brand_name: match?.brandName || null,
        match_confidence: match?.confidence || 'none',
        similarity_score: match?.score || 0,
        matched_via: match?.matchedVia || null,
        record_title: record.title.substring(0, 300),
        record_date: record.date,
        raw_data: record.rawData ? JSON.parse(JSON.stringify(record.rawData)) : null,
      },
      { onConflict: 'source_adapter,source_record_id', ignoreDuplicates: true }
    );
}

// ── Brand-Targeted Pipeline ────────────────────────────────────────────

export async function runPipeline(
  supabase: SupabaseClient,
  adapter: SourceAdapter,
  brandId: string,
  queryOverride?: string,
  maxResults = 50,
): Promise<PipelineResult> {
  const result: PipelineResult = {
    source: adapter.id,
    brandName: '',
    scanned: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    queued_for_review: 0,
  };

  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', adapter.featureFlagKey)
    .maybeSingle();

  if (config?.value === false) return result;

  const brand = await resolveBrandQueries(supabase, brandId);
  if (!brand) return result;
  result.brandName = brand.name;

  const queries = queryOverride ? [queryOverride] : brand.queries;
  const seenSourceIds = new Set<string>();

  for (const query of queries) {
    try {
      const records = await adapter.fetch(query, maxResults);
      for (const record of records) {
        if (seenSourceIds.has(record.sourceId)) continue;
        seenSourceIds.add(record.sourceId);
        result.scanned++;

        try {
          const eventId = await insertEvent(supabase, brandId, record);
          if (eventId) {
            result.inserted++;
          } else {
            result.skipped++;
          }
        } catch (err) {
          result.errors++;
        }

        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      result.errors++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[pipeline:${adapter.id}] ${brand.name}: inserted=${result.inserted} skipped=${result.skipped}`);
  return result;
}

// ── Discovery Pipeline (broad ingestion with firm matching) ────────────

/**
 * Fetch records broadly (e.g. recent FDA recalls) and resolve each
 * firm name to a brand using the company matcher.
 * 
 * High-confidence matches → insert event directly.
 * Low-confidence matches → queue for admin review.
 * No match → skip (or queue if record looks significant).
 */
export async function runDiscovery(
  supabase: SupabaseClient,
  adapter: SourceAdapter,
  searchTerms: string[],
  maxResults = 100,
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    source: adapter.id,
    totalRecords: 0,
    matched: 0,
    inserted: 0,
    queued: 0,
    noMatch: 0,
  };

  // Load the brand/alias cache for matching
  await loadMatchCache(supabase);

  const seenSourceIds = new Set<string>();

  for (const term of searchTerms) {
    try {
      const records = await adapter.fetch(term, maxResults);

      for (const record of records) {
        if (seenSourceIds.has(record.sourceId)) continue;
        seenSourceIds.add(record.sourceId);
        result.totalRecords++;

        // Try to match the firm name to a brand
        const match = matchFirmToBrand(record.firmName);

        if (!match) {
          result.noMatch++;
          continue;
        }

        // High confidence → insert directly
        if (match.confidence === 'exact' || match.confidence === 'alias' || match.confidence === 'parent') {
          try {
            const eventId = await insertEvent(supabase, match.brandId, record);
            if (eventId) {
              result.inserted++;
              result.matched++;
              console.log(`[discovery:${adapter.id}] ✅ "${record.firmName}" → ${match.brandName} (${match.matchedVia})`);
            } else {
              result.matched++; // matched but duplicate
            }
          } catch {
            // ignore
          }
        }
        // High fuzzy (≥0.85) → insert but also queue for review
        else if (match.confidence === 'fuzzy' && match.score >= 0.85) {
          try {
            const eventId = await insertEvent(supabase, match.brandId, record);
            if (eventId) {
              result.inserted++;
              result.matched++;
            }
          } catch {
            // ignore
          }
          await queueForReview(supabase, record, adapter.id, match);
          result.queued++;
        }
        // Low fuzzy → queue only, don't insert
        else if (match.confidence === 'fuzzy') {
          await queueForReview(supabase, record, adapter.id, match);
          result.queued++;
        }

        await new Promise(r => setTimeout(r, 80));
      }
    } catch (err) {
      console.error(`[discovery:${adapter.id}] Error for "${term}":`, err);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[discovery:${adapter.id}] total=${result.totalRecords} matched=${result.matched} inserted=${result.inserted} queued=${result.queued} noMatch=${result.noMatch}`);
  return result;
}

// ── Helpers ────────────────────────────────────────────────────────────

export async function runAllAdapters(
  supabase: SupabaseClient,
  adapters: SourceAdapter[],
  brandId: string,
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];
  for (const adapter of adapters) {
    const r = await runPipeline(supabase, adapter, brandId);
    results.push(r);
  }
  return results;
}
