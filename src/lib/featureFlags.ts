// Feature flags for the application
export const FEATURES = {
  PUSH_NOTIFICATIONS: false, // Enable when OneSignal is integrated
  DAILY_DIGEST: true, // Daily brand digest notifications (sender stub for now)
  ENABLE_COMMUNITY_OUTLOOK: true, // Community-driven category ratings (Beta)
  HIDE_COMPANY_SCORE: true, // Hide old company-level ethical score
  POLITICS_TWO_AXIS: true, // Two-axis politics (intensity + alignment) - BETA ENABLED
  SEEDING_ENABLED: import.meta.env.DEV, // Product seeding pipeline - PROD DISABLED
  QUEUE_ENRICHMENT_ENABLED: true, // Throttled enrichment queue
} as const;

// Log flags at boot for beta diagnostics
if (import.meta.env.DEV || window.location.search.includes('debug=flags')) {
  console.log('[FEATURE FLAGS]', FEATURES);
}
