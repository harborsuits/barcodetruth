/**
 * Clean up raw product category strings for consumer display.
 * 
 * Handles:
 * - "undefined" → null
 * - Long nested paths like "Health & Beauty > Personal Care > Cosmetics > Tools" → "Personal Care"
 * - Comma-separated duplicates like "Plant-based foods, Plant-based foods and beverages" → "Plant-Based Foods"
 * - Title-casing
 * - Max 2 labels
 */
export function formatCategory(raw: string | null | undefined): string | null {
  if (!raw || raw === 'undefined' || raw === 'null' || raw.trim() === '') return null;

  let cleaned = raw.trim();

  // Handle ">" delimited paths — take the 2nd-to-last segment (most specific useful level)
  if (cleaned.includes('>')) {
    const parts = cleaned.split('>').map(s => s.trim()).filter(Boolean);
    // Pick the most useful segment (2nd from end, or last if only 2)
    cleaned = parts.length >= 3 ? parts[parts.length - 2] : parts[parts.length - 1];
  }

  // Handle comma-separated lists — deduplicate and take first 2 unique
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const p of parts) {
      const key = p.toLowerCase().replace(/\s+/g, ' ');
      // Skip if a longer version already covers this
      const isDuplicate = [...seen].some(s => s.includes(key) || key.includes(s));
      if (!isDuplicate) {
        seen.add(key);
        unique.push(p);
      }
    }
    cleaned = unique.slice(0, 2).join(', ');
  }

  // Title-case
  cleaned = cleaned
    .split(/\s+/)
    .map(word => {
      if (['and', 'or', 'the', 'of', 'in', 'for', '&'].includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // Cap length
  if (cleaned.length > 50) {
    cleaned = cleaned.slice(0, 47) + '…';
  }

  return cleaned || null;
}
