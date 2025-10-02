import { parse } from 'tldts';

/**
 * Canonicalize a URL by removing tracking params, sorting query strings,
 * collapsing AMP paths, and normalizing trailing slashes.
 */
export function canonicalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    
    // Strip tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'msclkid', '_ga'
    ];
    trackingParams.forEach(p => url.searchParams.delete(p));
    
    // Sort remaining params for consistency
    const sortedParams = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    url.search = sortedParams ? `?${sortedParams}` : '';
    
    // Collapse AMP subpaths
    url.pathname = url.pathname
      .replace(/^\/amp\/?/, '/')
      .replace(/\/amp\/?$/, '/');
    
    // Drop trailing slash (except root)
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    
    return url.toString();
  } catch {
    return u;
  }
}

/**
 * Extract the registrable domain (e.g., "reuters.com" from "www.reuters.com")
 */
export function registrableDomain(u: string): string | null {
  try {
    const parsed = parse(u);
    return parsed.domain || null;
  } catch {
    return null;
  }
}

/**
 * Generate a lightweight fingerprint for text deduplication
 * Uses first 30 tokens of title + snippet for stable clustering
 */
export function textFingerprint(title: string, snippet?: string): string {
  const str = `${title} ${snippet || ''}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = str.split(/\s+/).filter(Boolean);
  const top = tokens.slice(0, 30).join(' ');
  
  // Simple 64-bit hash (FNV-1a variant)
  let h = BigInt('14695981039346656037');
  for (const ch of Buffer.from(top)) {
    h ^= BigInt(ch);
    h *= BigInt('1099511628211');
  }
  
  return h.toString(16);
}
