/**
 * Lightweight behavioral analytics for first-user validation.
 * Tracks: scan flow, profile views, alternatives clicks, drop-offs.
 * Sends to analytics_sessions + analytics_events tables.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "bt_session_id";
const SESSION_START_KEY = "bt_session_start";

function generateSessionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

class BehaviorTracker {
  private sessionId: string;
  private scanCount = 0;
  private queue: Array<{
    event_name: string;
    brand_id?: string;
    barcode?: string;
    properties: Record<string, any>;
  }> = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionStarted = false;

  constructor() {
    // Reuse session within 30min window
    const existing = sessionStorage.getItem(SESSION_KEY);
    const existingStart = sessionStorage.getItem(SESSION_START_KEY);
    const thirtyMin = 30 * 60 * 1000;

    if (existing && existingStart && Date.now() - Number(existingStart) < thirtyMin) {
      this.sessionId = existing;
      this.sessionStarted = true;
    } else {
      this.sessionId = generateSessionId();
      sessionStorage.setItem(SESSION_KEY, this.sessionId);
      sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
    }

    // Flush on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flush();
        }
      });
      window.addEventListener("beforeunload", () => this.flush());
    }
  }

  private async ensureSession() {
    if (this.sessionStarted) return;
    this.sessionStarted = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("analytics_sessions").insert({
        session_id: this.sessionId,
        device_type: getDeviceType(),
        source: document.referrer ? new URL(document.referrer).hostname : "direct",
        user_id: user?.id || null,
      } as any);
    } catch (e) {
      console.warn("[BT] session insert failed:", e);
    }
  }

  /**
   * Track a behavioral event. Properties should include context fields
   * like brand_name, company_type, score, score_band, etc.
   */
  track(
    eventName: string,
    opts?: {
      brand_id?: string;
      barcode?: string;
      properties?: Record<string, any>;
    }
  ) {
    const props = opts?.properties || {};

    if (eventName.startsWith("scan_")) {
      this.scanCount++;
    }

    this.queue.push({
      event_name: eventName,
      brand_id: opts?.brand_id,
      barcode: opts?.barcode,
      properties: {
        ...props,
        ts: Date.now(),
      },
    });

    // Auto-flush every 5 events or after 10s
    if (this.queue.length >= 5) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 10_000);
    }
  }

  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    await this.ensureSession();

    const batch = this.queue.splice(0);
    const rows = batch.map((e) => ({
      session_id: this.sessionId,
      event_name: e.event_name,
      brand_id: e.brand_id || null,
      barcode: e.barcode || null,
      properties: e.properties,
    }));

    try {
      const { error } = await supabase.from("analytics_events").insert(rows as any);
      if (error) {
        console.warn("[BT] flush error:", error.message);
        // Put back failed events
        this.queue.unshift(...batch);
      }
    } catch (e) {
      console.warn("[BT] flush exception:", e);
      this.queue.unshift(...batch);
    }

    // Update session scan count
    if (this.scanCount > 0) {
      try {
        await supabase
          .from("analytics_sessions")
          .update({ scan_count: this.scanCount, ended_at: new Date().toISOString() } as any)
          .eq("session_id", this.sessionId);
      } catch {
        // non-critical
      }
    }
  }

  /** Build standard context for scan-related events */
  scanContext(data: {
    barcode?: string;
    brand_id?: string;
    brand_name?: string;
    company_type?: string;
    category_slug?: string;
    subcategory_slug?: string;
    score?: number | null;
    alternatives_better_count?: number;
    alternatives_similar_count?: number;
    ownership_present?: boolean;
    logo_present?: boolean;
  }) {
    const score = data.score;
    const scoreBand =
      score === null || score === undefined
        ? "unrated"
        : score >= 65
        ? "good"
        : score >= 40
        ? "caution"
        : "poor";

    return {
      brand_id: data.brand_id,
      barcode: data.barcode,
      properties: {
        brand_name: data.brand_name,
        company_type: data.company_type,
        category_slug: data.category_slug,
        subcategory_slug: data.subcategory_slug,
        score: data.score,
        score_band: scoreBand,
        alternatives_better_count: data.alternatives_better_count ?? 0,
        alternatives_similar_count: data.alternatives_similar_count ?? 0,
        ownership_present: data.ownership_present ?? false,
        logo_present: data.logo_present ?? false,
      },
    };
  }
}

export const bt = new BehaviorTracker();
