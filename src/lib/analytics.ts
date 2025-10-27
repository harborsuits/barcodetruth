// Analytics tracking for UX features

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

class Analytics {
  private queue: AnalyticsEvent[] = [];
  private readonly STORAGE_KEY = 'analytics_queue';
  private readonly MAX_QUEUE_SIZE = 100;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadQueue();
    }
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue.slice(-this.MAX_QUEUE_SIZE)));
    } catch {
      // Ignore storage errors
    }
  }

  track(event: string, properties?: Record<string, any>) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: Date.now(),
    };

    this.queue.push(analyticsEvent);
    this.saveQueue();

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, properties);
    }

    // TODO: Send to analytics backend
    // For now, just store locally for future implementation
  }

  // Specific tracking methods for UX features
  trackAlternativesShown(brandId: string, alternativeCount: number, currentMatch: number) {
    this.track('alt_shown', {
      brand_id: brandId,
      alternative_count: alternativeCount,
      current_match: currentMatch,
    });
  }

  trackAlternativeClicked(brandId: string, alternativeId: string, improvement: number) {
    this.track('alt_clicked', {
      brand_id: brandId,
      alternative_id: alternativeId,
      improvement,
    });
  }

  trackWhyCareShown(brandId: string, bulletCount: number, categories: string[]) {
    this.track('why_shown', {
      brand_id: brandId,
      bullet_count: bulletCount,
      categories,
    });
  }

  trackBadgeHover(verificationType: string, sourceName: string) {
    this.track('badge_hover', {
      verification_type: verificationType,
      source_name: sourceName,
    });
  }

  trackSummaryView(eventId: string, category: string) {
    this.track('summary_view', {
      event_id: eventId,
      category,
    });
  }

  trackCompareClicked(currentBrandId: string, alternativeBrandId: string) {
    this.track('compare_clicked', {
      current_brand_id: currentBrandId,
      alternative_brand_id: alternativeBrandId,
    });
  }

  getQueue() {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
  }
}

export const analytics = new Analytics();
