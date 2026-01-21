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
  
  // Build cited events list
  const citedEvents: ScoreNarrative['citedEvents'] = [];
  
  // Generate narrative based on score range
  let text: string;
  
  if (score < 30) {
    // Very low score - emphasize concerns
    const eventSummaries = negativeEvents.slice(0, 3).map(e => {
      const summary = summarizeEventTitle(e.title, brandName);
      citedEvents.push({
        title: e.title,
        shortSummary: summary,
        impact: 'negative',
        sourceUrl: e.source_url,
      });
      return summary;
    });
    
    if (eventSummaries.length === 0) {
      text = `${brandName}'s low rating reflects concerning patterns. We're gathering more details.`;
    } else if (eventSummaries.length === 1) {
      text = `${brandName}'s low rating is primarily driven by ${eventSummaries[0]}. No significant positive signals were found in the last 90 days.`;
    } else {
      const firstEvent = eventSummaries[0];
      const otherEvents = eventSummaries.slice(1).join(' and ');
      text = `${brandName}'s low rating is driven by ${firstEvent}. ${capitalize(otherEvents)} also contributed to concerns.`;
      if (positiveEvents.length === 0) {
        text += ` No positive signals found recently.`;
      }
    }
  } else if (score < 50) {
    // Low score
    const eventSummaries = negativeEvents.slice(0, 2).map(e => {
      const summary = summarizeEventTitle(e.title, brandName);
      citedEvents.push({
        title: e.title,
        shortSummary: summary,
        impact: 'negative',
        sourceUrl: e.source_url,
      });
      return summary;
    });
    
    if (eventSummaries.length === 0) {
      text = `${brandName} shows concerning patterns in ${DIMENSION_LABELS[weakestDim]}.`;
    } else {
      text = `${brandName} shows concerning patterns including ${eventSummaries.join(' and ')}.`;
    }
    
    if (positiveEvents.length > 0) {
      const positiveSummary = summarizeEventTitle(positiveEvents[0].title, brandName);
      citedEvents.push({
        title: positiveEvents[0].title,
        shortSummary: positiveSummary,
        impact: 'positive',
        sourceUrl: positiveEvents[0].source_url,
      });
      text += ` Some positive factors (${positiveSummary}) provide partial offset.`;
    }
  } else if (score < 70) {
    // Medium/mixed score
    const topConcern = negativeEvents[0];
    const topPositive = positiveEvents[0];
    
    if (topConcern && topPositive) {
      const concernSummary = summarizeEventTitle(topConcern.title, brandName);
      const positiveSummary = summarizeEventTitle(topPositive.title, brandName);
      
      citedEvents.push({
        title: topConcern.title,
        shortSummary: concernSummary,
        impact: 'negative',
        sourceUrl: topConcern.source_url,
      });
      citedEvents.push({
        title: topPositive.title,
        shortSummary: positiveSummary,
        impact: 'positive',
        sourceUrl: topPositive.source_url,
      });
      
      text = `${brandName} shows mixed signals. Recent concerns (${concernSummary}) are balanced by positive factors (${positiveSummary}).`;
    } else if (topConcern) {
      const concernSummary = summarizeEventTitle(topConcern.title, brandName);
      citedEvents.push({
        title: topConcern.title,
        shortSummary: concernSummary,
        impact: 'negative',
        sourceUrl: topConcern.source_url,
      });
      text = `${brandName} shows a moderate record. Some concerns around ${concernSummary} temper the score.`;
    } else {
      text = `${brandName} shows a moderate track record with no major recent concerns.`;
    }
  } else {
    // High score (70+)
    if (positiveEvents.length > 0) {
      const positiveSummaries = positiveEvents.slice(0, 2).map(e => {
        const summary = summarizeEventTitle(e.title, brandName);
        citedEvents.push({
          title: e.title,
          shortSummary: summary,
          impact: 'positive',
          sourceUrl: e.source_url,
        });
        return summary;
      });
      
      text = `${brandName} scores well overall. Positive coverage includes ${positiveSummaries.join(' and ')}.`;
    } else if (negativeEvents.length === 0) {
      text = `${brandName} scores well with no major concerns found in recent coverage.`;
    } else {
      const minorConcern = summarizeEventTitle(negativeEvents[0].title, brandName);
      citedEvents.push({
        title: negativeEvents[0].title,
        shortSummary: minorConcern,
        impact: 'negative',
        sourceUrl: negativeEvents[0].source_url,
      });
      text = `${brandName} scores well overall. Minor concerns (${minorConcern}) have limited impact.`;
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
