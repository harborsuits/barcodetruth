/**
 * Clean up raw brand/product name strings for consumer display.
 * 
 * Handles:
 * - "Classico,New World Pasta Company" → "Classico"
 * - "natures promise spring water" → "Natures Promise Spring Water"  
 * - "Extra Light Olive Oil by Salov North America Corp" → "Salov North America"
 * - Trims corporate suffixes like "Corp", "Inc", "LLC", "Co."
 */

const CORP_SUFFIXES = /\s*,?\s*\b(Corp\.?|Inc\.?|LLC|Ltd\.?|Co\.?|Company|Corporation|Holdings|Enterprises|Group)\s*$/i;

export function formatBrandName(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return null;

  let cleaned = raw.trim();

  // If comma-separated, take the first segment (usually the brand name)
  if (cleaned.includes(',')) {
    const first = cleaned.split(',')[0].trim();
    // Only use first segment if it's a real name (not a single char)
    if (first.length > 1) {
      cleaned = first;
    }
  }

  // Strip corporate suffixes
  cleaned = cleaned.replace(CORP_SUFFIXES, '').trim();

  // Title-case if all lowercase
  if (cleaned === cleaned.toLowerCase()) {
    cleaned = cleaned
      .split(/\s+/)
      .map(word => {
        if (['and', 'or', 'the', 'of', 'in', 'for', 'by', '&'].includes(word.toLowerCase())) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
    // Always capitalize first word
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned || null;
}

/**
 * Clean product name for display.
 * Strips "by CompanyName" suffixes and normalizes case.
 */
export function formatProductName(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return null;

  let cleaned = raw.trim();

  // Remove trailing "by Company Name Corp" patterns
  cleaned = cleaned.replace(/\s+by\s+[\w\s&'.,-]+$/i, '').trim();

  // Strip corporate suffixes  
  cleaned = cleaned.replace(CORP_SUFFIXES, '').trim();

  // Title-case if all lowercase
  if (cleaned === cleaned.toLowerCase() && cleaned.length > 3) {
    cleaned = cleaned
      .split(/\s+/)
      .map(word => {
        if (['and', 'or', 'the', 'of', 'in', 'for', '&'].includes(word.toLowerCase())) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned || null;
}
