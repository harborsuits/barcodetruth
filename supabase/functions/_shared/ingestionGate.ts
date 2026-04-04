/**
 * Two-stage ingestion gate for Barcode Truth
 * 
 * Stage 1: Fast blocklist — kills pure financial noise at zero LLM cost
 * Stage 2: Brand attribution validation — prevents false entity matches
 */

// Stage 1: Financial noise blocklist
const FINANCIAL_BLOCKLIST = [
  'earnings per share', 'eps', 'revenue guidance', 'quarterly results',
  'fiscal year', 'stock price', 'analyst upgrade', 'analyst downgrade',
  'price target', 'shares rose', 'shares fell', 'beat estimates',
  'market cap', 'dividend', 'ipo', 'acquisition price', 'valuation',
  'quarterly earnings', 'revenue forecast', 'profit forecast',
  'earnings call', 'investor call', 'shareholder meeting',
  'stock split', 'buyback', 'share repurchase', 'market capitalization',
  'pe ratio', 'price-to-earnings', 'trading volume', 'stock rally',
  'stock plunge', 'bear market', 'bull market', 'fiscal quarter',
  'fy2024', 'fy2025', 'fy2026', 'fy2027', 'beat and raise',
  'consensus estimate', 'wall street estimate', 'analyst consensus',
];

// Exception: keep if article also contains ethical/worker impact signals
const ETHICAL_EXCEPTION_TERMS = [
  'workers', 'employees', 'layoffs', 'wages', 'salary', 'benefits',
  'communities', 'environment', 'safety', 'suppliers', 'lawsuit', 'fine',
  'penalty', 'discrimination', 'harassment', 'union', 'strike',
  'child labor', 'forced labor', 'pollution', 'spill', 'recall',
  'violation', 'whistleblower', 'retaliation', 'exploitation',
  'wage gap', 'pay gap', 'executive pay', 'ceo compensation',
  'median worker', 'minimum wage', 'living wage', 'severance',
  'plant closure', 'factory closure', 'job cuts', 'workforce reduction',
];

export interface GateResult {
  pass: boolean;
  reason?: string;
}

/**
 * Stage 1: Fast blocklist check (no LLM cost)
 * Returns false if article is pure financial noise
 */
export function passesFinancialBlocklist(title: string, description?: string): GateResult {
  const text = `${title} ${description || ''}`.toLowerCase();

  const matchedBlockTerm = FINANCIAL_BLOCKLIST.find(term => text.includes(term));
  if (!matchedBlockTerm) {
    return { pass: true };
  }

  // Check for ethical exception — keep if there's a human-impact angle
  const hasEthicalAngle = ETHICAL_EXCEPTION_TERMS.some(term => text.includes(term));
  if (hasEthicalAngle) {
    return { pass: true, reason: `Financial term "${matchedBlockTerm}" found but ethical exception triggered` };
  }

  return { pass: false, reason: `Blocked by financial filter: "${matchedBlockTerm}"` };
}

/**
 * Stage 2: Brand attribution validation
 * Ensures the brand name appears as an entity reference, not a place/adjective
 */
export function validateBrandAttribution(
  articleText: string,
  brandName: string
): GateResult {
  const textLower = articleText.toLowerCase();
  const nameLower = brandName.toLowerCase();

  // Skip validation for very short brand names (high false positive risk)
  if (nameLower.length <= 2) {
    return { pass: false, reason: `Brand name "${brandName}" too short for reliable attribution` };
  }

  // Geographic/adjectival patterns that indicate false attribution
  const geoPatterns = [
    `${nameLower} state`, `${nameLower} county`, `${nameLower} city`,
    `in ${nameLower},`, `${nameLower}-based`, `${nameLower}-style`,
    `${nameLower}-like`, `${nameLower} region`, `${nameLower} area`,
    `${nameLower} governor`, `${nameLower} senator`, `${nameLower} legislature`,
    `state of ${nameLower}`, `${nameLower} department of`,
  ];

  // Entity reference patterns that confirm the brand is the subject
  const entityPatterns = [
    `${nameLower} said`, `${nameLower} announced`, `${nameLower} reported`,
    `${nameLower}'s`, `by ${nameLower}`, `${nameLower} will`,
    `${nameLower} has`, `${nameLower} is`, `${nameLower} was`,
    `${nameLower} inc`, `${nameLower} corp`, `${nameLower} llc`,
    `${nameLower} company`, `${nameLower} group`, `${nameLower} brand`,
    `${nameLower} products`, `${nameLower} ceo`, `${nameLower} spokesperson`,
    `against ${nameLower}`, `${nameLower} agreed`, `${nameLower} settled`,
    `${nameLower} recalled`, `${nameLower} faces`, `${nameLower} fined`,
    `${nameLower} sued`, `${nameLower} launched`, `${nameLower} plans`,
  ];

  const hasGeoRef = geoPatterns.some(p => textLower.includes(p));
  const hasEntityRef = entityPatterns.some(p => textLower.includes(p));

  // If geo reference found and no entity reference, reject
  if (hasGeoRef && !hasEntityRef) {
    return { pass: false, reason: `"${brandName}" appears as geographic reference, not company entity` };
  }

  // If no entity reference at all, flag as weak attribution
  if (!hasEntityRef) {
    // Check if brand name appears at all
    if (!textLower.includes(nameLower)) {
      return { pass: false, reason: `Brand name "${brandName}" not found in article text` };
    }
    // Brand name present but no entity pattern — allow with warning
    return { pass: true, reason: `Weak attribution: "${brandName}" found but no entity reference pattern matched` };
  }

  return { pass: true };
}

/**
 * Combined gate: runs both stages
 */
export function runIngestionGate(
  title: string,
  description: string | undefined,
  articleText: string | undefined,
  brandName: string
): GateResult {
  // Stage 1: Financial blocklist
  const financialResult = passesFinancialBlocklist(title, description);
  if (!financialResult.pass) {
    return financialResult;
  }

  // Stage 2: Brand attribution (only if we have article text)
  const fullText = [title, description, articleText].filter(Boolean).join(' ');
  if (fullText.length > 20) {
    const attributionResult = validateBrandAttribution(fullText, brandName);
    if (!attributionResult.pass) {
      return attributionResult;
    }
  }

  return { pass: true };
}
