/**
 * Evidence Sufficiency Check
 * 
 * Determines if a brand has enough evidence across domains to justify showing a score.
 * This integrates with the tier system to prevent showing scores for brands with
 * insufficient or single-source evidence.
 * 
 * A brand rating is valid only if evidence exists in at least 3 of 5 domains:
 * 1. Identity & Ownership - official site, legal entity, parent company, filings
 * 2. Behavior / Actions - news, recalls, lawsuits, labor issues, environmental actions
 * 3. Claims & Positioning - sustainability claims, certifications, public commitments
 * 4. Third-party scrutiny - journalism, watchdogs, regulators, NGOs
 * 5. Market presence - products in circulation, retailers, recalls, consumer impact
 */

export type EvidenceDomain = 
  | 'identity'        // Official identity, ownership, legal structure
  | 'behavior'        // Actions, events, recalls, incidents
  | 'claims'          // Company claims, certifications, commitments
  | 'scrutiny'        // Third-party analysis, journalism, watchdogs
  | 'market';         // Market presence, products, retailers

export interface DomainCoverage {
  domain: EvidenceDomain;
  label: string;
  description: string;
  covered: boolean;
  sources: string[];      // What sources contribute to this domain
  confidence: 'none' | 'weak' | 'strong';
}

export interface EvidenceSufficiencyResult {
  sufficient: boolean;           // Can we show a score?
  score: number;                 // 0-100 sufficiency score
  coveredDomains: DomainCoverage[];
  missingDomains: DomainCoverage[];
  domainsCovered: number;
  domainsRequired: number;       // 3 of 5
  recommendation: 'show_score' | 'show_preview' | 'show_stub';
  reason: string;
  nextSteps: string[];          // What would improve coverage
}

const DOMAIN_METADATA: Record<EvidenceDomain, { label: string; description: string }> = {
  identity: {
    label: 'Identity & Ownership',
    description: 'Official website, legal entity, parent company, regulatory filings',
  },
  behavior: {
    label: 'Behavior & Actions',
    description: 'News events, recalls, lawsuits, labor issues, environmental actions',
  },
  claims: {
    label: 'Claims & Positioning',
    description: 'Sustainability claims, certifications, public commitments',
  },
  scrutiny: {
    label: 'Third-Party Scrutiny',
    description: 'Journalism, watchdog reports, regulatory analysis, NGO assessments',
  },
  market: {
    label: 'Market Presence',
    description: 'Products in circulation, retailers, consumer impact',
  },
};

/**
 * Check if brand has evidence in Identity domain
 */
function checkIdentityDomain(brandData: BrandData): DomainCoverage {
  const sources: string[] = [];
  let confidence: 'none' | 'weak' | 'strong' = 'none';
  
  if (brandData.website) {
    sources.push('Official website');
    confidence = 'weak';
  }
  if (brandData.wikidata_qid) {
    sources.push('Wikidata');
    confidence = confidence === 'weak' ? 'strong' : 'weak';
  }
  if (brandData.hasOwnership) {
    sources.push('Ownership records');
    confidence = 'strong';
  }
  if (brandData.legalEntity) {
    sources.push('Legal entity filings');
    confidence = 'strong';
  }
  
  return {
    domain: 'identity',
    ...DOMAIN_METADATA.identity,
    covered: sources.length > 0,
    sources,
    confidence,
  };
}

/**
 * Check if brand has evidence in Behavior domain
 */
function checkBehaviorDomain(brandData: BrandData): DomainCoverage {
  const sources: string[] = [];
  let confidence: 'none' | 'weak' | 'strong' = 'none';
  
  if (brandData.eventCount > 0) {
    sources.push(`${brandData.eventCount} events tracked`);
    confidence = brandData.eventCount >= 5 ? 'strong' : 'weak';
  }
  if (brandData.hasRecalls) {
    sources.push('FDA/CPSC recalls');
  }
  if (brandData.hasRegulatory) {
    sources.push('EPA/OSHA records');
    confidence = 'strong';
  }
  
  return {
    domain: 'behavior',
    ...DOMAIN_METADATA.behavior,
    covered: sources.length > 0,
    sources,
    confidence,
  };
}

/**
 * Check if brand has evidence in Claims domain
 */
function checkClaimsDomain(brandData: BrandData): DomainCoverage {
  const sources: string[] = [];
  let confidence: 'none' | 'weak' | 'strong' = 'none';
  
  if (brandData.hasCertifications) {
    sources.push('Certifications on record');
    confidence = 'strong';
  }
  if (brandData.hasSustainabilityReport) {
    sources.push('Sustainability report');
    confidence = 'weak';
  }
  if (brandData.hasPublicCommitments) {
    sources.push('Public commitments tracked');
    confidence = 'weak';
  }
  
  return {
    domain: 'claims',
    ...DOMAIN_METADATA.claims,
    covered: sources.length > 0,
    sources,
    confidence,
  };
}

/**
 * Check if brand has evidence in Scrutiny domain
 */
function checkScrutinyDomain(brandData: BrandData): DomainCoverage {
  const sources: string[] = [];
  let confidence: 'none' | 'weak' | 'strong' = 'none';
  
  if (brandData.newsSourceCount >= 2) {
    sources.push(`${brandData.newsSourceCount} news sources`);
    confidence = brandData.newsSourceCount >= 5 ? 'strong' : 'weak';
  }
  if (brandData.hasWatchdogReports) {
    sources.push('Watchdog reports');
    confidence = 'strong';
  }
  if (brandData.hasNGOAnalysis) {
    sources.push('NGO assessments');
    confidence = 'strong';
  }
  
  return {
    domain: 'scrutiny',
    ...DOMAIN_METADATA.scrutiny,
    covered: sources.length > 0,
    sources,
    confidence,
  };
}

/**
 * Check if brand has evidence in Market domain
 */
function checkMarketDomain(brandData: BrandData): DomainCoverage {
  const sources: string[] = [];
  let confidence: 'none' | 'weak' | 'strong' = 'none';
  
  if (brandData.productCount > 0) {
    sources.push(`${brandData.productCount} products tracked`);
    confidence = brandData.productCount >= 10 ? 'strong' : 'weak';
  }
  if (brandData.retailerPresence) {
    sources.push('Retailer data');
    confidence = 'weak';
  }
  if (brandData.hasConsumerReports) {
    sources.push('Consumer reports');
    confidence = 'strong';
  }
  
  return {
    domain: 'market',
    ...DOMAIN_METADATA.market,
    covered: sources.length > 0,
    sources,
    confidence,
  };
}

/**
 * Brand data needed to check evidence sufficiency
 */
export interface BrandData {
  // Identity domain
  website?: string | null;
  wikidata_qid?: string | null;
  hasOwnership?: boolean;
  legalEntity?: string | null;
  
  // Behavior domain
  eventCount: number;
  hasRecalls?: boolean;
  hasRegulatory?: boolean;
  
  // Claims domain
  hasCertifications?: boolean;
  hasSustainabilityReport?: boolean;
  hasPublicCommitments?: boolean;
  
  // Scrutiny domain
  newsSourceCount: number;
  hasWatchdogReports?: boolean;
  hasNGOAnalysis?: boolean;
  
  // Market domain
  productCount: number;
  retailerPresence?: boolean;
  hasConsumerReports?: boolean;
}

/**
 * MAIN FUNCTION: Check if a brand has sufficient evidence for a score
 */
export function checkEvidenceSufficiency(brandData: BrandData): EvidenceSufficiencyResult {
  const DOMAINS_REQUIRED = 3;
  
  // Check each domain
  const domainResults: DomainCoverage[] = [
    checkIdentityDomain(brandData),
    checkBehaviorDomain(brandData),
    checkClaimsDomain(brandData),
    checkScrutinyDomain(brandData),
    checkMarketDomain(brandData),
  ];
  
  const coveredDomains = domainResults.filter(d => d.covered);
  const missingDomains = domainResults.filter(d => !d.covered);
  const domainsCovered = coveredDomains.length;
  
  // Calculate sufficiency score (0-100)
  const sufficiencyScore = Math.round((domainsCovered / 5) * 100);
  
  // Determine recommendation
  let recommendation: 'show_score' | 'show_preview' | 'show_stub';
  let reason: string;
  
  if (domainsCovered >= DOMAINS_REQUIRED) {
    recommendation = 'show_score';
    reason = `Evidence exists across ${domainsCovered} domains`;
  } else if (domainsCovered >= 1) {
    recommendation = 'show_preview';
    reason = `Only ${domainsCovered} of ${DOMAINS_REQUIRED} required domains have evidence`;
  } else {
    recommendation = 'show_stub';
    reason = 'No evidence collected yet';
  }
  
  // Generate next steps for improvement
  const nextSteps: string[] = [];
  for (const domain of missingDomains.slice(0, 2)) {
    switch (domain.domain) {
      case 'identity':
        nextSteps.push('Add official website or verify ownership structure');
        break;
      case 'behavior':
        nextSteps.push('Track news events and regulatory records');
        break;
      case 'claims':
        nextSteps.push('Document certifications or sustainability claims');
        break;
      case 'scrutiny':
        nextSteps.push('Add coverage from independent news sources');
        break;
      case 'market':
        nextSteps.push('Link products or track retailer presence');
        break;
    }
  }
  
  return {
    sufficient: domainsCovered >= DOMAINS_REQUIRED,
    score: sufficiencyScore,
    coveredDomains,
    missingDomains,
    domainsCovered,
    domainsRequired: DOMAINS_REQUIRED,
    recommendation,
    reason,
    nextSteps,
  };
}

/**
 * Quick check if brand can show a score (lighter weight than full check)
 */
export function canShowScore(
  eventCount: number,
  distinctSources: number,
  hasDescription: boolean
): boolean {
  // Quick heuristic: at least 3 events from 2+ sources, with description
  return eventCount >= 3 && distinctSources >= 2 && hasDescription;
}

/**
 * Get human-readable status for evidence level
 */
export function getEvidenceStatus(result: EvidenceSufficiencyResult): {
  label: string;
  color: string;
  icon: string;
} {
  if (result.sufficient) {
    return {
      label: 'Verified',
      color: 'text-green-600 dark:text-green-400',
      icon: '✓',
    };
  }
  
  if (result.domainsCovered >= 1) {
    return {
      label: 'In Progress',
      color: 'text-amber-600 dark:text-amber-400',
      icon: '◐',
    };
  }
  
  return {
    label: 'Collecting',
    color: 'text-muted-foreground',
    icon: '○',
  };
}
