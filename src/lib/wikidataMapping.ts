/**
 * Known Wikidata QID mappings for major brands
 * Used to auto-populate missing wikidata_qid values
 */
export const KNOWN_WIKIDATA_QIDS: Record<string, string> = {
  'tesco': 'Q487494',
  'walmart': 'Q483551',
  'amazon': 'Q3884',
  'target': 'Q1046951',
  'costco': 'Q715583',
  'kroger': 'Q153732',
  'walgreens': 'Q1591889',
  'cvs': 'Q2078880',
  'home depot': 'Q864407',
  'lowes': 'Q1373493',
  'best buy': 'Q533415',
  'starbucks': 'Q37158',
  'mcdonalds': 'Q38076',
  'subway': 'Q244457',
  'wendys': 'Q550258',
  'burger king': 'Q177054',
  'coca-cola': 'Q2813',
  'pepsi': 'Q334800',
  'nike': 'Q483915',
  'adidas': 'Q3895',
  'apple': 'Q312',
  'microsoft': 'Q2283',
  'google': 'Q95',
  'facebook': 'Q380',
  'meta': 'Q380',
  'tesla': 'Q478214',
  'ford': 'Q44294',
  'general motors': 'Q81965',
  'toyota': 'Q53268',
  'honda': 'Q9584',
  'nestle': 'Q160746',
  'unilever': 'Q157062',
  'procter & gamble': 'Q822179',
  'johnson & johnson': 'Q154950',
  'pfizer': 'Q206921',
  'moderna': 'Q30715381',
  'shell': 'Q154950',
  'exxon': 'Q156238',
  'bp': 'Q152057',
  'chevron': 'Q319642',
};

/**
 * Get Wikidata QID for a brand name (case-insensitive)
 */
export function getWikidataQid(brandName: string | null | undefined): string | null {
  if (!brandName) return null;
  const normalized = brandName.toLowerCase().trim();
  return KNOWN_WIKIDATA_QIDS[normalized] || null;
}
