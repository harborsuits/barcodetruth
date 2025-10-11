import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = performance.now();
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    // Fetch pending discoveries (sources without specific article URLs)
    const { data: pending, error } = await supabase
      .from('event_sources')
      .select('id, event_id, source_name, source_url, canonical_url, is_generic')
      .is('canonical_url', null)
      .eq('is_generic', true)
      .limit(50);

    if (error) throw error;

    let resolved = 0;
    let skipped = 0;

    const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (const row of (pending ?? [])) {
      try {
        // Try agency rules first (deterministic permalinks)
        const articleFromAgency = await resolveAgencyLink(supabase, row.event_id);
        if (articleFromAgency) {
          await updateResolved(supabase, row.id, articleFromAgency);
          resolved++;
          await pause(300); // ~3 req/s max
          continue;
        }

        // Try outlet discovery (RSS/sitemap/homepage parsing)
        if (row.source_url) {
          const articleFromOutlet = await resolveOutletDiscovery(row.source_url, row.source_name);
          if (articleFromOutlet) {
            await updateResolved(supabase, row.id, articleFromOutlet);
            resolved++;
            await pause(300);
            continue;
          }
        }

        skipped++;
      } catch (e) {
        console.warn('[resolver] error', row.id, e);
        skipped++;
      }
      
      await pause(100); // small delay even on skip
    }

    const duration = Math.round(performance.now() - t0);
    console.log(JSON.stringify({
      level: 'info',
      fn: 'resolve-evidence-links',
      processed: pending?.length ?? 0,
      resolved,
      skipped,
      duration_ms: duration,
    }));

    return new Response(
      JSON.stringify({ processed: pending?.length ?? 0, resolved, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[resolve-evidence-links] Error:', e);
    return new Response(
      JSON.stringify({ error: e.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ----- Agency-specific permalink resolution -----

async function resolveAgencyLink(supabase: any, eventId: string): Promise<{url:string,title?:string,published_at?:string}|null> {
  const { data: ev } = await supabase
    .from('brand_events')
    .select('category, raw_data, occurred_at, title')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!ev?.raw_data) return null;

  const raw = ev.raw_data;
  
  // OSHA permalinks
  if (raw.activity_nr) {
    return { 
      url: `https://www.osha.gov/ords/imis/establishment.inspection_detail?id=${encodeURIComponent(raw.activity_nr)}`,
      title: ev.title,
      published_at: ev.occurred_at
    };
  }
  if (raw.establishment_name && raw.estab_name) {
    // Fallback to establishment page if we have the ID
    const estabId = raw.estab_id || raw.establishment_id;
    if (estabId) {
      return {
        url: `https://www.osha.gov/establishments/${encodeURIComponent(estabId)}`,
        title: ev.title,
        published_at: ev.occurred_at
      };
    }
  }

  // EPA ECHO permalinks
  if (raw.case_number || raw.enforcement_case_id) {
    const caseId = raw.case_number || raw.enforcement_case_id;
    return {
      url: `https://echo.epa.gov/enforcement-case-report?id=${encodeURIComponent(caseId)}`,
      title: ev.title,
      published_at: ev.occurred_at
    };
  }
  if (raw.registry_id || raw.frs_id) {
    const facilityId = raw.registry_id || raw.frs_id;
    return {
      url: `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(facilityId)}`,
      title: ev.title,
      published_at: ev.occurred_at
    };
  }

  // FEC permalinks
  if (raw.image_number || raw.file_number) {
    const imageNum = raw.image_number || raw.file_number;
    return {
      url: `https://docquery.fec.gov/cgi-bin/fecimg/?${encodeURIComponent(imageNum)}`,
      title: ev.title,
      published_at: ev.occurred_at
    };
  }

  return null;
}

// ----- Outlet discovery (RSS/sitemap/homepage) -----

async function resolveOutletDiscovery(discoveryUrl: string, outlet?: string|null) {
  const home = await safeGet(discoveryUrl);
  if (!home) return null;

  // Try to find feeds
  const feeds = extractFeeds(home.html, home.url);
  for (const feed of feeds) {
    const rss = await safeGet(feed);
    if (!rss) continue;
    const item = bestRssItemMatch(rss.text);
    if (item) return item;
  }

  // Fallback: scan homepage for article-looking links
  const anchors = extractAnchors(home.html, home.url);
  const candidates = anchors
    .filter(a => looksLikeArticlePath(a.url))
    .map(a => ({ ...a, score: scoreCandidate(a) }))
    .sort((a,b) => b.score - a.score);

  if (candidates[0] && candidates[0].score >= 0.5) {
    // Fetch canonical from the candidate page
    const page = await safeGet(candidates[0].url);
    const canonical = page ? extractCanonical(page.html, page.url) : null;
    return { url: canonical ?? candidates[0].url, title: candidates[0].text || undefined };
  }

  return null;
}

// ----- Parsing utilities -----

async function safeGet(url: string, timeoutMs = 10000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, { 
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EvidenceResolver/1.0)' }
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    return { url: res.url, html: /html|xml/.test(ct) ? text : '', text };
  } catch { return null; }
}

function extractFeeds(html: string, base: string): string[] {
  const links = Array.from(html.matchAll(/<link[^>]+rel=["']?(?:alternate|feed)["']?[^>]*>/gi));
  const urls = links.map(m => {
    const href = (m[0].match(/href=["']([^"']+)/i)?.[1]) || '';
    const type = (m[0].match(/type=["']([^"']+)/i)?.[1]) || '';
    if (!/rss|atom|xml/i.test(type + href)) return null;
    try { return new URL(href, base).toString(); } catch { return null; }
  }).filter(Boolean) as string[];
  return Array.from(new Set(urls));
}

function extractAnchors(html: string, base: string): {url:string,text:string}[] {
  const anchors = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis));
  return anchors.map(m => {
    const href = m[1]; 
    const text = m[2].replace(/<[^>]+>/g,'').trim();
    try { return { url: new URL(href, base).toString(), text }; } catch { return { url: '', text: '' }; }
  }).filter(a => !!a.url);
}

function looksLikeArticlePath(url: string) {
  try {
    const u = new URL(url); 
    const p = u.pathname.toLowerCase();
    return /\/(20\d{2}\/\d{2}\/\d{2}|20\d{2}\/\d{2}|news|article|stories|story|business|politics|environment)\//.test(p);
  } catch { return false; }
}

function extractCanonical(html: string, base: string): string | null {
  const m1 = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1];
  const m2 = html.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)/i)?.[1];
  const href = m1 || m2;
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return null; }
}

function scoreCandidate(a: {url:string,text:string}): number {
  let score = 0.3; // base if it looks like an article
  try {
    const u = new URL(a.url);
    if (/\/20\d{2}\//.test(u.pathname)) score += 0.3;
    if (a.text.length > 20) score += 0.2; // has substantial text
  } catch {}
  return Math.min(1, score);
}

function bestRssItemMatch(xml: string): {url:string,title?:string,published_at?:string}|null {
  const items = Array.from(xml.matchAll(/<item>[\s\S]*?<\/item>/gi));
  for (const it of items) {
    const link = it[0].match(/<link>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/link>|<link>([^<]+)<\/link>/i);
    const title = it[0].match(/<title>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/title>|<title>([^<]+)<\/title>/i);
    const pub = it[0].match(/<pubDate>([^<]+)<\/pubDate>/i);
    const url = (link?.[1] || link?.[2] || '').trim();
    if (url) return { url, title: (title?.[1] || title?.[2])?.trim(), published_at: pub?.[1] };
  }
  return null;
}

async function tryArchive(url: string): Promise<string|null> {
  try {
    const res = await fetch(`https://web.archive.org/save/${encodeURIComponent(url)}`, { 
      method: 'GET',
      signal: AbortSignal.timeout(8000)
    });
    const saved = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .catch(() => null);
    return saved?.archived_snapshots?.closest?.url ?? null;
  } catch { return null; }
}

function isLikelyGeneric(url: string): boolean {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    if (p === '' || p === '/') return true;
    if (/(press|about|news|index|landing)$/i.test(p)) return true;
    if (/^(osha\.gov|epa\.gov)$/i.test(u.hostname) && p.split('/').filter(Boolean).length < 2) return true;
    return false;
  } catch { return true; }
}

async function updateResolved(supabase: any, id: string, found: {url:string,title?:string,published_at?:string}) {
  // Safety check: don't resolve if it's still generic
  if (isLikelyGeneric(found.url)) {
    console.warn(JSON.stringify({ level: 'warn', action: 'skip_generic', source_id: id, url: found.url }));
    return;
  }

  // Try to archive the permalink
  const archiveUrl = await tryArchive(found.url);

  await supabase.from('event_sources').update({
    canonical_url: found.url,
    article_title: found.title ?? null,
    article_published_at: found.published_at ?? null,
    archive_url: archiveUrl,
    is_generic: false,
  }).eq('id', id).is('canonical_url', null); // idempotent
  
  console.log(JSON.stringify({
    level: 'info',
    action: 'resolved_permalink',
    source_id: id,
    url: found.url,
    archived: !!archiveUrl,
  }));
}
