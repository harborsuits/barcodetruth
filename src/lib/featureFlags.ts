// Feature flags for the application
export const FEATURES = {
  PUSH_NOTIFICATIONS: false, // Enable when OneSignal is integrated
  DAILY_DIGEST: true, // Daily brand digest notifications (sender stub for now)
  ENABLE_COMMUNITY_OUTLOOK: true, // Community-driven category ratings (Beta)
  HIDE_COMPANY_SCORE: true, // Hide old company-level ethical score
  POLITICS_TWO_AXIS: import.meta.env.DEV, // Two-axis politics (intensity + alignment)
  SEEDING_ENABLED: import.meta.env.DEV, // Product seeding pipeline
  QUEUE_ENRICHMENT_ENABLED: true, // Throttled enrichment queue
} as const;
