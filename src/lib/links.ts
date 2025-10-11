/**
 * URL normalization and link preference utilities
 */

export function normalizeUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    // Strip tracking parameters
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'mc_cid', 'mc_eid']
      .forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return null;
  }
}

export function isHomepage(u: string): boolean {
  try {
    const url = new URL(u);
    return (url.pathname === '' || url.pathname === '/');
  } catch {
    return false;
  }
}

export function isGeneric(u: string): boolean {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, '');
    if (isHomepage(u)) return true;
    if (/(press|about|news|index|landing)/i.test(url.pathname)) return true;
    // Agency roots that often show hubs
    if (/^(osha\.gov|epa\.gov)$/i.test(host) && url.pathname.split('/').filter(Boolean).length < 2) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Preferred link selection: archive → canonical → source (article_url)
 */
export function preferredLink(row: {
  archive_url?: string | null;
  canonical_url?: string | null;
  url?: string | null; // legacy field OR article_url
}) {
  const archive = normalizeUrl(row.archive_url);
  const canonical = normalizeUrl(row.canonical_url);
  const source = normalizeUrl(row.url);

  // Pick in order
  const chosen = archive || canonical || source || null;
  const generic = chosen ? isGeneric(chosen) : true;

  return { chosen, archive, canonical, source, generic };
}

/**
 * Check if article title seems relevant to brand
 */
export function seemsRelevantToBrand(title?: string | null, brand?: string | null): boolean {
  if (!title || !brand) return true; // Don't block if we lack fields
  const t = title.toLowerCase();
  const b = brand.toLowerCase();
  return t.includes(b) || t.replace(/[^\w]/g, ' ').split(/\s+/).some(w => w.length > 3 && b.includes(w));
}
