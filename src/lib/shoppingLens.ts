export const shoppingReasons = [
  { id: 'ownership', label: 'Who owns it', short: 'Different ownership', description: 'Follow the brand to the company behind it.' },
  { id: 'ingredients', label: 'Ingredients & nutrition', short: 'Check the label', description: 'Look at what is in this specific product.' },
  { id: 'recalls', label: 'Recalls & alerts', short: 'Check product alerts', description: 'Check official notices against your package.' },
  { id: 'values', label: 'Company actions', short: 'Fit with my values', description: 'Examine political spending, social issues and working conditions.' },
  { id: 'local', label: 'Buy local', short: 'Explore local producers', description: 'Find a farm or market for your next shop.' },
] as const;

export type ShoppingReason = typeof shoppingReasons[number]['id'];

export function safeEvidenceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

export function labelIngredients(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const text = (metadata as Record<string, unknown>).ingredients;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
}

// A text match is a reading aid only. Absence never establishes allergen safety.
export function findIngredientMention(ingredients: string | null, term: string): 'mentioned' | 'not-found' | 'unknown' {
  if (!ingredients || term.trim().length < 2) return 'unknown';
  return ingredients.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()) ? 'mentioned' : 'not-found';
}

export type ShopNote = { barcode: string; name: string; reason: ShoppingReason; savedAt: string };
export const SHOP_NOTES_KEY = 'barcodetruth:next-shop:v1';
export function parseShopNotes(raw: string | null): ShopNote[] {
  try {
    const data: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is ShopNote => !!item && typeof item === 'object' &&
      typeof item.barcode === 'string' && /^(?:\d{8}|\d{12}|\d{13})$/.test(item.barcode) && typeof item.name === 'string' && item.name.length <= 250 &&
      shoppingReasons.some(reason => reason.id === item.reason) && typeof item.savedAt === 'string').slice(0, 30);
  } catch { return []; }
}

// This is a conservative text filter for research leads, never evidence of a
// finding or ideological alignment. Raw catalog categories contain unrelated news.
export function mentionsShoppingTopic(text: string, topic: string): boolean {
  const patterns: Record<string, RegExp> = {
    politics: /\b(political|lobbying|lobbyist|campaign finance|campaign contribution|political action committee|PAC|political donation)\b/i,
    inclusion: /\b(LGBTQ?\+?|transgender|sexual orientation|gender identity|same.sex|gay rights)\b/i,
    reproductive: /\b(abortion|reproductive|contraception|contraceptive)\b/i,
    religion: /\b(religious|religion|faith.based|religious freedom)\b/i,
    labor: /\b(labor|labour|union|strike|layoffs?|worker safety|OSHA|wage|working conditions)\b/i,
    environment: /\b(environmental|pollution|emissions?|climate|deforestation|renewable|carbon|wastewater)\b/i,
  };
  return patterns[topic]?.test(text) ?? false;
}

export const alternativeRequirements: Record<ShoppingReason, string> = {
  ownership: 'A comparable product with a different, sourced ownership group.',
  ingredients: 'A comparable product whose current label meets your ingredient or nutrition preference.',
  recalls: 'A comparable product checked against the applicable recall notice, including lot and date details.',
  values: 'A comparable product with documented company actions that address the issue you care about.',
  local: 'A producer or market in the area you choose, with the product and availability checked before you go.',
};
