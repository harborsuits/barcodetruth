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

// Runtime flag logging with ?debug=flags support
(function logFlagsIfRequested() {
  try {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get("debug");
    
    // Allow console logging in dev OR when explicitly requested
    const shouldLog =
      debug === "flags" ||
      (import.meta.env.DEV && (debug === null || debug === "true"));

    if (shouldLog) {
      // Expose for quick console inspection
      (window as any).FEATURES = FEATURES;
      
      console.groupCollapsed("[FEATURES] Runtime flags");
      console.table(FEATURES);
      console.groupEnd();
    }
  } catch { /* no-op */ }
})();
