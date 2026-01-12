/**
 * Centralized risk and alignment language glossary
 * All consumer-facing copy for scores, alignment, and ownership should use these constants
 * 
 * Design principle: "Exposure" not "guilt" — describe relationships, not judgments
 */

export const SCORE_LABELS = {
  high: { label: 'Low risk', description: 'No significant concerns found' },
  medium: { label: 'Mixed record', description: 'Some concerns, but also positives' },
  low: { label: 'High exposure', description: 'Multiple concerns in areas you care about' },
} as const;

export const ALIGNMENT_LABELS = {
  high: 'Strong alignment with your values',
  medium: 'Partial alignment — some tradeoffs',
  low: 'Low alignment — review concerns below',
} as const;

export const OWNERSHIP_LABELS = {
  header: 'Who Benefits from Your Purchase',
  parent: 'Revenue flows to',
  independent: 'Independently operated',
  public: 'Publicly traded — no parent corporation',
  parentCompany: 'Parent Company',
  corporateOwner: 'Corporate Owner',
} as const;

export const EVIDENCE_LABELS = {
  sectionTitle: 'Recent Activity',
  negativeSectionTitle: 'Areas of Concern',
  positiveSectionTitle: 'Positive Indicators',
  noEvents: 'No significant activity in the last 90 days',
  userAgencySubtext: 'Recent events that may affect your decision — you decide what matters',
  personalizedSubtext: 'Based on your value preferences, these events most affect your score',
} as const;

export const TRUST_SIGNAL_LABELS = {
  // Labor
  laborDispute: 'Labor exposure',
  workerConcerns: 'Worker issues reported',
  
  // Environment
  environmentalViolation: 'Environmental exposure',
  sustainabilityConcern: 'Sustainability questions',
  sustainabilityInitiative: 'Sustainability initiative',
  
  // Legal
  activeLawsuit: 'Legal exposure',
  legalMatter: 'Legal matter',
  
  // Politics
  politicalActivity: 'Political contributions',
  
  // Safety
  productRecall: 'Product recall',
  
  // General
  recentConcerns: 'Recent issues',
  noRecentConcerns: 'No recent concerns',
} as const;

export const BASELINE_EXPLANATION = 
  'This is a baseline score using equal weight across all concerns. Sign in to see how it matches your specific values.';

export const BASELINE_TOOLTIP = 
  'An average weighting across all concerns — not personalized to your values yet.';

export const TRUST_PLEDGE = {
  title: 'How We Stay Neutral',
  principles: [
    { label: 'Facts are shared', detail: 'Events are verified and categorized, not editorialized' },
    { label: 'Weighting is personal', detail: 'Your score reflects your priorities — someone else might see this differently' },
    { label: 'You decide what matters', detail: 'We surface evidence; you make the call' }
  ],
  footer: "This score isn't universal truth — it's how this brand aligns with you.",
} as const;

export const ALTERNATIVES_LABELS = {
  header: 'Higher-Aligned Alternatives',
  buttonText: 'More aligned options',
  deltaLabel: 'higher alignment',
  description: 'These brands align more closely with your priorities',
} as const;

export const PRODUCT_BRAND_EXPLAINER = 
  "This product's profile reflects the broader practices of its brand.";

/**
 * Get score label based on numeric score
 */
export function getScoreLabel(score: number): string {
  if (score >= 70) return SCORE_LABELS.high.label;
  if (score >= 40) return SCORE_LABELS.medium.label;
  return SCORE_LABELS.low.label;
}

/**
 * Get alignment label based on numeric score
 */
export function getAlignmentLabel(score: number): string {
  if (score >= 70) return ALIGNMENT_LABELS.high;
  if (score >= 40) return ALIGNMENT_LABELS.medium;
  return ALIGNMENT_LABELS.low;
}

/**
 * Get score description based on numeric score
 */
export function getScoreDescription(score: number): string {
  if (score >= 70) return SCORE_LABELS.high.description;
  if (score >= 40) return SCORE_LABELS.medium.description;
  return SCORE_LABELS.low.description;
}
