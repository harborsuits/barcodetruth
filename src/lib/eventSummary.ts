// Generate quick context summaries for events

type CategoryKey = 'labor' | 'environment' | 'politics' | 'social' | 'general';

const TOPIC_LABELS: Record<CategoryKey, string> = {
  labor: 'Labor',
  environment: 'Environment',
  politics: 'Political Influence',
  social: 'Social Impact',
  general: 'General'
};

interface EventForSummary {
  category?: string;
  title?: string | null;
  description?: string | null;
  category_code?: string | null;
}

export function summarizeEvent(event: EventForSummary): string {
  const category = (event.category || 'general') as CategoryKey;
  const topic = TOPIC_LABELS[category] || 'General';
  
  // Get the main text (title or description)
  const mainText = event.title || event.description || 'Event reported';
  
  // Clean up noisy prefixes
  const cleaned = mainText
    .replace(/^\s*(Breaking:|Update:|BREAKING:|UPDATE:)\s*/i, '')
    .trim();
  
  // Truncate if too long
  const truncated = cleaned.length > 90 
    ? cleaned.substring(0, 87) + '...' 
    : cleaned;
  
  return `${topic}: ${truncated}`;
}

export function summarizeEventShort(event: EventForSummary): string {
  // Even shorter version for inline use
  const mainText = event.title || event.description || 'Event reported';
  const cleaned = mainText
    .replace(/^\s*(Breaking:|Update:|BREAKING:|UPDATE:)\s*/i, '')
    .trim();
  
  return cleaned.length > 60 
    ? cleaned.substring(0, 57) + '...' 
    : cleaned;
}
