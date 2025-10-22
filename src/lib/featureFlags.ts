// Feature flags for the application
export const FEATURES = {
  PUSH_NOTIFICATIONS: false, // Enable when OneSignal is integrated
  DAILY_DIGEST: false, // Enable when push notifications are ready
  ENABLE_COMMUNITY_OUTLOOK: true, // Community-driven category ratings (Beta)
  HIDE_COMPANY_SCORE: true, // Hide old company-level ethical score
} as const;
