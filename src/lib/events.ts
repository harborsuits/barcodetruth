export type SliderKey = 'labor' | 'environment' | 'politics' | 'social';
export type Verification = 'unverified' | 'corroborated' | 'official';

export const formatMonthYear = (iso?: string) => {
  if (!iso) return 'Date unknown';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const attributionPrefix = (v?: Verification) =>
  v === 'official' ? 'Per' : v === 'unverified' ? 'Reported by' : 'According to';

export const topImpacts = (impact?: Partial<Record<SliderKey, number>>, limit = 2) => {
  if (!impact) return [];
  return Object.entries(impact)
    .map(([k, v]) => ({ key: k as SliderKey, val: Number(v) }))
    .filter(({ val }) => !Number.isNaN(val) && val !== 0)
    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
    .slice(0, limit);
};

export const phrasing = {
  verified: (s: string, d?: string) => `According to ${s}${d ? `, ${formatMonthYear(d)}` : ''}.`,
  official: (s: string, d?: string) => `Per ${s}${d ? `, ${formatMonthYear(d)}` : ''}.`,
  unverified: (s: string, d?: string) => `Reported by ${s}${d ? `, ${formatMonthYear(d)}` : ''}. Not yet corroborated.`
};

export const lineFromEvent = (e: any) => {
  const src = e.sources?.[0] ?? e.source;
  if (!src) return 'Source unavailable.';
  if (e.verification === 'official') return phrasing.official(src.name, src.date);
  if (e.verification === 'unverified') return phrasing.unverified(src.name, src.date);
  return phrasing.verified(src.name, src.date);
};
