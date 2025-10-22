/**
 * RSS/Atom Feed Parser
 * Handles both RSS 2.0 and Atom feeds, normalizing them into a common format
 */

export interface NormalizedItem {
  title: string;
  link: string;
  published_at: string; // ISO timestamp
  source_name: string;
  summary?: string;
  author?: string;
  guid?: string;
}

/**
 * Parse RSS/Atom XML into normalized items
 */
export function parseRSS(xml: string, fallbackSourceName = 'Unknown'): NormalizedItem[] {
  const items: NormalizedItem[] = [];
  
  try {
    // Detect feed type
    const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"');
    
    if (isAtom) {
      return parseAtomFeed(xml, fallbackSourceName);
    } else {
      return parseRSSFeed(xml, fallbackSourceName);
    }
  } catch (error) {
    console.error('[rssParser] Failed to parse feed:', error);
    return [];
  }
}

/**
 * Parse RSS 2.0 feed
 */
function parseRSSFeed(xml: string, fallbackSourceName: string): NormalizedItem[] {
  const items: NormalizedItem[] = [];
  
  // Extract channel-level source name if available
  const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title>(.*?)<\/title>/);
  const channelSource = channelTitleMatch ? cleanText(channelTitleMatch[1]) : fallbackSourceName;
  
  // Match all <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');
    const guid = extractTag(itemXml, 'guid');
    const author = extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator');
    
    // For Google News, try to extract original source from <source> tag
    const sourceTag = extractTag(itemXml, 'source');
    const sourceName = sourceTag || channelSource;
    
    if (title && link) {
      items.push({
        title: cleanText(title),
        link: cleanText(link),
        published_at: parseDate(pubDate),
        source_name: cleanText(sourceName),
        summary: description ? cleanText(description) : undefined,
        author: author ? cleanText(author) : undefined,
        guid: guid ? cleanText(guid) : undefined,
      });
    }
  }
  
  return items;
}

/**
 * Parse Atom feed
 */
function parseAtomFeed(xml: string, fallbackSourceName: string): NormalizedItem[] {
  const items: NormalizedItem[] = [];
  
  // Extract feed-level title
  const feedTitleMatch = xml.match(/<feed[^>]*>[\s\S]*?<title[^>]*>(.*?)<\/title>/);
  const feedSource = feedTitleMatch ? cleanText(feedTitleMatch[1]) : fallbackSourceName;
  
  // Match all <entry>...</entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    
    const title = extractTag(entryXml, 'title');
    const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["']/);
    const link = linkMatch ? linkMatch[1] : '';
    const updated = extractTag(entryXml, 'updated') || extractTag(entryXml, 'published');
    const summary = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content');
    const id = extractTag(entryXml, 'id');
    const authorMatch = entryXml.match(/<author>[\s\S]*?<name>(.*?)<\/name>/);
    const author = authorMatch ? authorMatch[1] : undefined;
    
    if (title && link) {
      items.push({
        title: cleanText(title),
        link: cleanText(link),
        published_at: parseDate(updated),
        source_name: cleanText(feedSource),
        summary: summary ? cleanText(summary) : undefined,
        author: author ? cleanText(author) : undefined,
        guid: id ? cleanText(id) : undefined,
      });
    }
  }
  
  return items;
}

/**
 * Extract text content from a tag
 */
function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

/**
 * Clean HTML entities and whitespace from text
 */
function cleanText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // Remove CDATA
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Parse date string into ISO timestamp
 */
function parseDate(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString();
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}
