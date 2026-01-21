// Generate layman's rhetoric explanations for brand scores

import type { TopScoringEvent } from "@/hooks/useTopScoringEvents";

interface NarrativeInput {
  brandName: string;
  score: number;
  dimensionScores: {
    labor: number;
    environment: number;
    politics: number;
    social: number;
  };
  topEvents: TopScoringEvent[];
}

export interface ScoreNarrative {
  text: string;
  citedEvents: Array<{
    title: string;
    shortSummary: string;
    impact: 'positive' | 'negative';
    sourceUrl: string | null;
  }>;
}

type DimensionKey = 'labor' | 'environment' | 'politics' | 'social';

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  labor: 'worker and labor issues',
  environment: 'environmental concerns',
  politics: 'political activity',
  social: 'social impact',
};

/**
 * Summarize an event title into a short, readable phrase
 * e.g., "Tyson Foods beef - processing plant in Lexington officially closes"
 * → "Lexington plant closure"
 */
export function summarizeEventTitle(title: string, brandName: string): string {
  // Remove brand name (case insensitive)
  let summary = title.replace(new RegExp(brandName, 'gi'), '').trim();
  
  // Remove common prefixes/suffixes
  summary = summary
    .replace(/^[-–—:,\s]+/, '')
    .replace(/[-–—:,\s]+$/, '')
    .trim();

  // Pattern matching for common event types - extract key phrases
  const patterns: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => string }> = [
    // Money amounts with context
    { 
      regex: /\$(\d+(?:\.\d+)?)\s*(million|billion|M|B|m|b)/i, 
      extract: (m) => {
        const amount = m[1];
        const unit = m[2].charAt(0).toUpperCase();
        // Check context: settlement, fine, penalty
        if (/settlement/i.test(summary)) return `$${amount}${unit} settlement`;
        if (/fine|penalt/i.test(summary)) return `$${amount}${unit} fine`;
        if (/lawsuit|suit/i.test(summary)) return `$${amount}${unit} lawsuit`;
        return `$${amount}${unit} case`;
      }
    },
    // Plant closures with location
    { 
      regex: /(\w+)\s+(?:plant|facility|factory).*?clos/i, 
      extract: (m) => `${m[1]} plant closure` 
    },
    // Generic plant closures
    { regex: /plant.*?clos|facility.*?clos/i, extract: () => 'plant closure' },
    // Layoffs
    { regex: /(\d+[,\d]*)\s*(?:workers?|employees?|jobs?).*?(?:laid off|layoff|cut)/i, extract: (m) => `${m[1].replace(/,/g, '')} workers laid off` },
    { regex: /layoff|laid off/i, extract: () => 'layoffs announced' },
    // Lawsuits and legal
    { regex: /class.?action/i, extract: () => 'class action lawsuit' },
    { regex: /lawsuit|sued|suing/i, extract: () => 'lawsuit filed' },
    { regex: /settlement/i, extract: () => 'legal settlement' },
    // Recalls
    { regex: /recall.*?(\d+)/i, extract: (m) => `${m[1]} product recall` },
    { regex: /recall/i, extract: () => 'product recall' },
    // Regulatory
    { regex: /EPA|environmental.*?violation/i, extract: () => 'EPA violation' },
    { regex: /OSHA|workplace.*?(?:safety|violation)/i, extract: () => 'OSHA violation' },
    { regex: /FDA.*?warning/i, extract: () => 'FDA warning' },
    { regex: /fine|penalt/i, extract: () => 'regulatory fine' },
    // Worker issues
    { regex: /strike/i, extract: () => 'worker strike' },
    { regex: /union.*?(?:vote|drive|effort)/i, extract: () => 'union activity' },
    { regex: /wage.*?(?:theft|violation)/i, extract: () => 'wage violation' },
    // Environment
    { regex: /spill|leak.*?(?:oil|chemical|toxic)/i, extract: () => 'environmental spill' },
    { regex: /pollution|pollut/i, extract: () => 'pollution incident' },
    { regex: /carbon|emission/i, extract: () => 'emissions concern' },
    // Positive patterns
    { regex: /certification|certified/i, extract: () => 'certification achieved' },
    { regex: /award|recognized/i, extract: () => 'recognition received' },
    { regex: /initiative|program.*?launch/i, extract: () => 'new initiative' },
    { regex: /sustainability|sustainable/i, extract: () => 'sustainability effort' },
    { regex: /donation|donat/i, extract: () => 'charitable donation' },
  ];
  
  for (const { regex, extract } of patterns) {
    const match = summary.match(regex);
    if (match) {
      return extract(match);
    }
  }
  
  // Fallback: first 5 meaningful words, cleaned up
  const words = summary
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^(the|and|for|its|has|was|are|from|with)$/i.test(w))
    .slice(0, 5);
  
  if (words.length === 0) return 'recent event';
  
  return words.join(' ') + (words.length >= 5 ? '...' : '');
}

/**
 * Deduplicate and collapse event summaries with counts
 * e.g., ["lawsuit filed", "lawsuit filed", "plant closure"] → ["lawsuits ×2", "plant closure"]
 */
function collapseSummaries(summaries: string[]): string[] {
  const counts = new Map<string, number>();
  
  for (const s of summaries) {
    const normalized = s.toLowerCase().trim();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  
  return Array.from(counts.entries()).map(([summary, count]) => {
    if (count === 1) {
      return capitalize(summary);
    }
    // Pluralize common terms
    let plural = summary;
    if (summary.endsWith(' filed')) {
      // "lawsuit filed" → "lawsuits"
      plural = summary.replace(/(\w+)\s+filed$/, '$1s');
    } else if (summary.includes('lawsuit')) {
      plural = 'lawsuits';
    } else if (summary.includes('settlement')) {
      plural = 'settlements';
    } else if (summary.includes('closure')) {
      plural = 'closures';
    } else if (summary.includes('violation')) {
      plural = 'violations';
    } else if (summary.includes('recall')) {
      plural = 'recalls';
    } else {
      plural = summary;
    }
    return `${capitalize(plural)} ×${count}`;
  });
}

/**
 * Format event chips for display - collapse duplicates with counts
 */
function buildCitedEvents(
  events: NarrativeInput['topEvents'],
  brandName: string,
  impact: 'positive' | 'negative'
): ScoreNarrative['citedEvents'] {
  // Group by summary
  const grouped = new Map<string, { count: number; events: typeof events }>();
  
  for (const e of events) {
    const summary = summarizeEventTitle(e.title, brandName);
    const existing = grouped.get(summary);
    if (existing) {
      existing.count++;
      existing.events.push(e);
    } else {
      grouped.set(summary, { count: 1, events: [e] });
    }
  }
  
  return Array.from(grouped.entries()).map(([summary, { count, events: groupEvents }]) => {
    let displaySummary = summary;
    if (count > 1) {
      // Pluralize and add count
      if (summary.includes('lawsuit') || summary.endsWith(' filed')) {
        displaySummary = `lawsuits ×${count}`;
      } else if (summary.includes('settlement')) {
        displaySummary = `settlements ×${count}`;
      } else if (summary.includes('closure')) {
        displaySummary = `closures ×${count}`;
      } else {
        displaySummary = `${summary} ×${count}`;
      }
    }
    
    return {
      title: groupEvents[0].title,
      shortSummary: displaySummary,
      impact,
      sourceUrl: groupEvents[0].source_url,
    };
  });
}

/**
 * Get dimension-specific concern description
 */
function getDimensionConcernLabel(dim: DimensionKey): string {
  const labels: Record<DimensionKey, string> = {
    labor: 'worker-related',
    environment: 'environmental',
    politics: 'political-influence',
    social: 'social-impact',
  };
  return labels[dim] || 'concerning';
}

/**
 * Check if events are recent (within 30 days)
 */
function hasRecentEvents(events: NarrativeInput['topEvents']): boolean {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return events.some(e => new Date(e.event_date).getTime() > thirtyDaysAgo);
}

/**
 * Generate a layman's rhetoric explanation for why the score is what it is
 */
export function generateScoreNarrative(input: NarrativeInput): ScoreNarrative | null {
  const { brandName, score, dimensionScores, topEvents } = input;
  
  // No events = no narrative (we need evidence to cite)
  if (!topEvents || topEvents.length === 0) {
    return {
      text: `This score is based on baseline industry patterns. We're actively monitoring for news and regulatory activity.`,
      citedEvents: [],
    };
  }
  
  // Separate positive and negative events
  const negativeEvents = topEvents.filter(e => e.effective_impact < 0);
  const positiveEvents = topEvents.filter(e => e.effective_impact > 0);
  
  // Find the weakest dimension
  const dimensions = Object.entries(dimensionScores) as [DimensionKey, number][];
  const [weakestDim] = dimensions.sort(([, a], [, b]) => a - b)[0];
  const dimLabel = getDimensionConcernLabel(weakestDim);
  
  // Check recency for temporal grounding
  const isRecent = hasRecentEvents(negativeEvents.length > 0 ? negativeEvents : positiveEvents);
  const timePhrase = isRecent ? 'recent' : '';
  
  // Generate narrative based on score range
  let text: string;
  let citedEvents: ScoreNarrative['citedEvents'] = [];
  
  if (score < 30) {
    // Very low score - emphasize concerns with dimension specificity
    const eventsToUse = negativeEvents.slice(0, 3);
    const summaries = eventsToUse.map(e => summarizeEventTitle(e.title, brandName));
    const collapsedSummaries = collapseSummaries(summaries);
    citedEvents = buildCitedEvents(eventsToUse, brandName, 'negative');
    
    if (collapsedSummaries.length === 0) {
      text = `${brandName}'s low rating reflects ${dimLabel} concerns. We're gathering more details.`;
    } else {
      const eventList = collapsedSummaries.join(' and ').toLowerCase();
      text = `${brandName} shows concerning ${dimLabel} patterns, driven by ${timePhrase ? 'recent ' : ''}${eventList}.`;
      if (positiveEvents.length === 0) {
        text += ` No significant positive signals were identified in recent coverage.`;
      }
    }
  } else if (score < 50) {
    // Low score - tie to weakest dimension
    const eventsToUse = negativeEvents.slice(0, 2);
    const summaries = eventsToUse.map(e => summarizeEventTitle(e.title, brandName));
    const collapsedSummaries = collapseSummaries(summaries);
    citedEvents = buildCitedEvents(eventsToUse, brandName, 'negative');
    
    if (collapsedSummaries.length === 0) {
      text = `${brandName} shows concerning patterns in ${DIMENSION_LABELS[weakestDim]}.`;
    } else {
      const eventList = collapsedSummaries.join(' and ').toLowerCase();
      text = `${brandName} shows ${dimLabel} concerns, including ${timePhrase ? 'recent ' : ''}${eventList}.`;
    }
    
    if (positiveEvents.length > 0) {
      const positiveCited = buildCitedEvents(positiveEvents.slice(0, 1), brandName, 'positive');
      citedEvents = [...citedEvents, ...positiveCited];
      text += ` Some positive factors provide partial offset.`;
    }
  } else if (score < 70) {
    // Medium/mixed score
    const topConcern = negativeEvents[0];
    const topPositive = positiveEvents[0];
    
    if (topConcern && topPositive) {
      const concernSummary = summarizeEventTitle(topConcern.title, brandName);
      const positiveSummary = summarizeEventTitle(topPositive.title, brandName);
      
      citedEvents = [
        ...buildCitedEvents([topConcern], brandName, 'negative'),
        ...buildCitedEvents([topPositive], brandName, 'positive'),
      ];
      
      text = `${brandName} shows mixed signals. ${isRecent ? 'Recent' : 'Some'} concerns (${concernSummary.toLowerCase()}) are balanced by positive factors (${positiveSummary.toLowerCase()}).`;
    } else if (topConcern) {
      const concernSummary = summarizeEventTitle(topConcern.title, brandName);
      citedEvents = buildCitedEvents([topConcern], brandName, 'negative');
      text = `${brandName} shows a moderate record. ${isRecent ? 'Recent' : 'Some'} ${concernSummary.toLowerCase()} tempers the score.`;
    } else {
      text = `${brandName} shows a moderate track record with no major ${timePhrase} concerns.`;
    }
  } else {
    // High score (70+)
    if (positiveEvents.length > 0) {
      const eventsToUse = positiveEvents.slice(0, 2);
      const summaries = eventsToUse.map(e => summarizeEventTitle(e.title, brandName));
      const collapsedSummaries = collapseSummaries(summaries);
      citedEvents = buildCitedEvents(eventsToUse, brandName, 'positive');
      
      const eventList = collapsedSummaries.join(' and ').toLowerCase();
      text = `${brandName} scores well overall. ${isRecent ? 'Recent p' : 'P'}ositive coverage includes ${eventList}.`;
    } else if (negativeEvents.length === 0) {
      text = `${brandName} scores well with no major concerns found in recent coverage.`;
    } else {
      const minorConcern = summarizeEventTitle(negativeEvents[0].title, brandName);
      citedEvents = buildCitedEvents([negativeEvents[0]], brandName, 'negative');
      text = `${brandName} scores well overall. Minor concerns (${minorConcern.toLowerCase()}) have limited impact.`;
    }
  }
  
  return {
    text,
    citedEvents,
  };
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
