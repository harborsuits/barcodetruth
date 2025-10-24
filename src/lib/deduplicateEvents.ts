import { compareTwoStrings } from 'string-similarity';

export interface EventWithSources {
  event_id: string;
  title: string;
  category: string;
  source_url?: string;
  created_at: string;
  [key: string]: any;
  duplicates?: {
    event_id: string;
    source_url?: string;
    source_name?: string;
  }[];
}

export function deduplicateEvents(events: any[]): EventWithSources[] {
  if (!events || events.length === 0) return [];
  
  const groups: EventWithSources[] = [];
  const processed = new Set<string>();
  
  events.forEach(event => {
    if (processed.has(event.event_id)) return;
    
    // Find similar titles (>75% similarity)
    const duplicates = events.filter(other => {
      if (other.event_id === event.event_id) return false;
      if (processed.has(other.event_id)) return false;
      
      const titleSimilarity = compareTwoStrings(
        event.title.toLowerCase(),
        other.title.toLowerCase()
      );
      
      return titleSimilarity > 0.75;
    });
    
    // Mark all duplicates as processed
    duplicates.forEach(dup => processed.add(dup.event_id));
    processed.add(event.event_id);
    
    // Create grouped event
    groups.push({
      ...event,
      duplicates: duplicates.map(d => ({
        event_id: d.event_id,
        source_url: d.source_url,
        source_name: extractSourceName(d.source_url)
      }))
    });
  });
  
  return groups;
}

function extractSourceName(url?: string): string {
  if (!url) return 'Unknown';
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const name = domain.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Unknown';
  }
}
