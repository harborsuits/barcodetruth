import { useEffect } from "react";

/**
 * Prewarm snapshot cache on app load to ensure offline availability
 */
export function useSnapshotPrewarm() {
  useEffect(() => {
    if (!navigator.onLine) return;

    const prewarm = async () => {
      try {
        console.log('[Prewarm] Fetching latest snapshot pointer...');
        
        // Fetch the latest.json pointer (always fresh)
        const latestRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/snapshots/latest.json?v=${Date.now()}`,
          { cache: 'no-store' }
        );
        
        if (!latestRes.ok) {
          // Ignore 400/404 - storage not set up yet
          if (latestRes.status !== 400 && latestRes.status !== 404) {
            console.warn('[Prewarm] Unexpected status:', latestRes.status);
          }
          return;
        }

        const latest = await latestRes.json();
        const trendingVersion = latest.trending;
        
        if (!trendingVersion) {
          console.log('[Prewarm] No trending snapshot version');
          return;
        }

        // Prefetch the versioned trending snapshot (will be cached by SW)
        console.log('[Prewarm] Prefetching trending snapshot:', trendingVersion);
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/snapshots/${trendingVersion}`
        );
        
        console.log('[Prewarm] Snapshot prewarmed successfully');
      } catch (error) {
        console.log('[Prewarm] Failed to prewarm snapshots:', error);
      }
    };

    // Prewarm after a short delay to not block initial render
    const timer = setTimeout(prewarm, 1000);
    return () => clearTimeout(timer);
  }, []);
}
