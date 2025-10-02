import { supabase } from '@/integrations/supabase/client';
import { registrableDomain, canonicalizeUrl, textFingerprint } from './urlNorm';

/**
 * Enrich an event source with ownership data from news_orgs table
 * and populate normalization fields (canonical URL, domain, fingerprint)
 */
export async function enrichSourceOwnership(
  sourceId: string,
  url: string,
  title?: string,
  snippet?: string,
  sourceDate?: string
) {
  const domain = registrableDomain(url);
  const canonical = canonicalizeUrl(url);
  const fp = textFingerprint(title || '', snippet);
  const dayBucket = sourceDate ? new Date(sourceDate).toISOString().slice(0, 10) : null;

  // Look up ownership
  let owner = 'Unknown';
  let kind = 'publisher';
  
  if (domain) {
    const { data: org } = await supabase
      .from('news_orgs')
      .select('owner, kind')
      .eq('domain', domain)
      .maybeSingle();
    
    if (org) {
      owner = org.owner;
      kind = org.kind;
    }
  }

  // Update source with enrichment data
  await supabase
    .from('event_sources')
    .update({
      canonical_url: canonical,
      registrable_domain: domain,
      domain_owner: owner,
      domain_kind: kind,
      title_fp: fp,
      day_bucket: dayBucket
    })
    .eq('id', sourceId);
}

/**
 * Count independent owners (distinct domain_owner) for a set of sources
 */
export function countIndependentOwners(sources: Array<{ domain_owner?: string | null }>): number {
  const owners = new Set(
    sources
      .map(s => s.domain_owner)
      .filter(Boolean)
  );
  return owners.size;
}

/**
 * Check if a source is from an official domain (gov, court records, etc.)
 */
export function isOfficialSource(verification: string): boolean {
  return verification.toLowerCase() === 'official';
}
