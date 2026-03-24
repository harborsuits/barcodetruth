/**
 * Unified Regulatory Ingestion Pipeline
 * 
 * All government data sources feed into this single pipeline:
 *   source adapter → normalize → match brand → dedupe → insert event → activation queue
 * 
 * Each source only needs to implement a RegulatoryAdapter that returns RawRegRecord[].
 * The pipeline handles brand matching, deduplication, event creation, and source tracking.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RELEVANCE_MAX_SCORE } from "./scoringConstants.ts";

// ── Types ──────────────────────────────────────────────────────────────

export interface RawRegRecord {
  /** Unique ID from the source (recall number, inspection ID, case number) */
  sourceId: string;
  /** Human-readable title */
  title: string;
  /** Longer description */
  description: string;
  /** Company/firm name as it appears in the dataset */
  firmName: string;
  /** ISO date string of when the event occurred */
  date: string;
  /** Source URL for linking */
  sourceUrl: string;
  /** Event category: labor, environment, social, politics */
  category: 'labor' | 'environment' | 'social' | 'politics';
  /** Negative impact score (-5 to -1) */
  impact: number;
  /** Source agency name */
  sourceName: string;
  /** Domain of the source */
  sourceDomain: string;
  /** Full name of the agency */
  agencyFullName: string;
  /** Raw JSON data to store */
  rawData?: Record<string, unknown>;
}

export interface SourceAdapter {
  /** Unique source identifier */
  id: string;
  /** Feature flag key in app_config */
  featureFlagKey: string;
  /** Fetch records for a given search query */
  fetch(query: string, maxResults: number): Promise<RawRegRecord[]>;
}

export interface PipelineResult {
  source: string;
  brandName: string;
  scanned: number;
  inserted: number;
  skipped: number;
  errors: number;
}

// ── Brand Resolution ───────────────────────────────────────────────────

/**
 * Resolve search queries for a brand: name + parent_company + aliases
 */
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

/**
 * Check if an event already exists by source_url
 */
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

  // Check duplicate
  if (await isDuplicate(supabase, uniqueUrl)) return null;

  // Insert event (occurred_at is generated, don't include it)
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
    if (error.code === '23505') return null; // Race condition duplicate
    console.error(`[pipeline] Insert error for ${record.sourceId}:`, error.message);
    return null;
  }

  // Insert evidence source
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

// ── Main Pipeline ──────────────────────────────────────────────────────

/**
 * Run a source adapter against a single brand.
 * Returns the pipeline result with counts.
 */
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
  };

  // Check feature flag
  const { data: config } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', adapter.featureFlagKey)
    .maybeSingle();

  if (config?.value === false) {
    console.log(`[pipeline:${adapter.id}] Disabled via feature flag`);
    return result;
  }

  // Resolve brand queries
  const brand = await resolveBrandQueries(supabase, brandId);
  if (!brand) {
    console.error(`[pipeline:${adapter.id}] Brand not found: ${brandId}`);
    return result;
  }
  result.brandName = brand.name;

  const queries = queryOverride ? [queryOverride] : brand.queries;
  const seenSourceIds = new Set<string>();

  for (const query of queries) {
    try {
      console.log(`[pipeline:${adapter.id}] Fetching for "${query}"`);
      const records = await adapter.fetch(query, maxResults);
      
      for (const record of records) {
        // Skip if we've already seen this sourceId in this run
        if (seenSourceIds.has(record.sourceId)) continue;
        seenSourceIds.add(record.sourceId);
        
        result.scanned++;

        try {
          const eventId = await insertEvent(supabase, brandId, record);
          if (eventId) {
            result.inserted++;
            console.log(`[pipeline:${adapter.id}] ✅ ${record.sourceId}`);
          } else {
            result.skipped++;
          }
        } catch (err) {
          result.errors++;
          console.error(`[pipeline:${adapter.id}] Error inserting ${record.sourceId}:`, err);
        }

        // Rate limit between inserts
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.error(`[pipeline:${adapter.id}] Fetch error for "${query}":`, err);
      result.errors++;
    }

    // Rate limit between queries
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[pipeline:${adapter.id}] ${brand.name}: scanned=${result.scanned} inserted=${result.inserted} skipped=${result.skipped}`);
  return result;
}

/**
 * Run multiple adapters against a single brand, then optionally promote.
 */
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
