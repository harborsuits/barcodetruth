/**
 * Shared brand normalization logic
 * Used across seed-products, merge-products, and frontend search
 */

export function normalizeBrandLabel(label: string | null | undefined): string {
  if (!label) return '';
  
  return label
    .toLowerCase()
    .replace(/^xx:/i, '') // Strip "xx:" prefix
    .replace(/[-_&]+/g, ' ') // Hyphens, underscores, ampersands → space
    .trim();
}

export function capitalizeBrandName(normalized: string): string {
  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
