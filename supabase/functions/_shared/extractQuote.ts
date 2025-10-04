/**
 * Smart quote extraction from HTML articles
 * Prefers sentences with brand name, action verbs, numbers/dates
 */

export function extractQuote(htmlText: string, brandName: string): string {
  try {
    // Try meta description first
    const ogMatch = htmlText.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch?.[1]) {
      return clampWords(ogMatch[1], 25);
    }

    // Try standard meta description
    const metaMatch = htmlText.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (metaMatch?.[1]) {
      return clampWords(metaMatch[1], 25);
    }

    // Extract text from body (simple approach - strip tags)
    const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const text = bodyMatch?.[1] || htmlText;
    const cleanText = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Split into sentences and score them
    const sentences = cleanText
      .split(/[.!?]+\s+/)
      .slice(0, 40)
      .filter(s => s.length > 20 && s.length < 300);

    const scored = sentences.map(s => {
      let score = 0;
      
      // Contains brand name
      if (new RegExp(`\\b${escapeRegex(brandName)}\\b`, 'i').test(s)) {
        score += 2;
      }
      
      // Contains money/numbers
      if (/\$[\d,.]+|million|billion|thousand|\d+%/i.test(s)) {
        score += 2;
      }
      
      // Contains action verbs
      if (/\b(fined|recall|lawsuit|settlement|violat(ed|ion)|penalty|injur(ed|y)|death|contamination|breach)\b/i.test(s)) {
        score += 2;
      }
      
      // Contains dates
      if (/\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{4})\b/i.test(s)) {
        score += 1;
      }

      return { s, score };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0];
    return best ? clampWords(best.s, 25) : clampWords(sentences[0] || '', 25);
  } catch (e) {
    console.error('Quote extraction error:', e);
    return '';
  }
}

function clampWords(text: string, max = 25): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  return words.slice(0, max).join(' ') + '...';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
