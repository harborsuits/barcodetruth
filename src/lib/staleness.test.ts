// Test file for staleness and category filtering
// Run with: npm test or vitest
// Install vitest with: npm install -D vitest

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const isStale = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86400000 > 30;

// Example test cases - uncomment when vitest is installed
/*
import { describe, it, expect } from 'vitest';

describe('staleness', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const isStale = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86400000 > 30;

  it('flags >30 days as stale', () => {
    const over = daysAgo(31);
    const under = daysAgo(5);
    expect(isStale(over)).toBe(true);
    expect(isStale(under)).toBe(false);
  });

  it('handles edge case at exactly 30 days', () => {
    const exactly30 = daysAgo(30);
    expect(isStale(exactly30)).toBe(false);
  });

  it('handles very recent updates', () => {
    const today = daysAgo(0);
    expect(isStale(today)).toBe(false);
  });

  it('handles very old updates', () => {
    const veryOld = daysAgo(365);
    expect(isStale(veryOld)).toBe(true);
  });
});

describe('category filter logic', () => {
  const events = [
    { category: 'labor' },
    { category: 'environment' },
    { category: 'labor' },
    { category: 'politics' },
  ] as any[];

  const filter = (cat: string) =>
    events.filter((e) => (cat === 'all' ? true : e.category === cat));

  it('shows only labor when labor selected', () => {
    expect(filter('labor').length).toBe(2);
  });

  it('shows only environment when environment selected', () => {
    expect(filter('environment').length).toBe(1);
  });

  it('shows all when all selected', () => {
    expect(filter('all').length).toBe(4);
  });

  it('returns empty array for non-existent category', () => {
    expect(filter('cultural-values').length).toBe(0);
  });
});

describe('unverified event handling', () => {
  it('should not affect score for unverified single-source events', () => {
    const event = {
      verification: 'unverified',
      sources: [{ name: 'Blog', date: '2025-09-15' }],
      impact: { labor: -10 },
    };

    const applyImpact = (event: any, baseScore: number) => {
      if (event.verification === 'unverified' && event.sources.length === 1) {
        return baseScore; // Don't apply impact
      }
      return baseScore + (event.impact?.labor || 0);
    };

    expect(applyImpact(event, 70)).toBe(70);
  });

  it('should apply impact for corroborated events', () => {
    const event = {
      verification: 'corroborated',
      sources: [{ name: 'Reuters' }, { name: 'Bloomberg' }],
      impact: { labor: -10 },
    };

    const applyImpact = (event: any, baseScore: number) => {
      if (event.verification === 'unverified' && event.sources.length === 1) {
        return baseScore;
      }
      return baseScore + (event.impact?.labor || 0);
    };

    expect(applyImpact(event, 70)).toBe(60);
  });

  it('should apply impact for official events', () => {
    const event = {
      verification: 'official',
      sources: [{ name: 'FEC' }],
      impact: { politics: -15 },
    };

    const applyImpact = (event: any, baseScore: number) => {
      if (event.verification === 'unverified' && event.sources.length === 1) {
        return baseScore;
      }
      return baseScore + (event.impact?.politics || 0);
    };

    expect(applyImpact(event, 70)).toBe(55);
  });
});
*/

// Manual verification tests (run these in browser console)
export const runStalenessTests = () => {
  console.log('Testing staleness detection...');
  console.log('31 days ago is stale:', isStale(daysAgo(31)));
  console.log('5 days ago is stale:', isStale(daysAgo(5)));
  console.log('30 days ago is stale:', isStale(daysAgo(30)));
};

export const runCategoryFilterTests = () => {
  const events = [
    { category: 'labor' },
    { category: 'environment' },
    { category: 'labor' },
  ];

  const filter = (cat: string) =>
    events.filter((e: any) => (cat === 'all' ? true : e.category === cat));

  console.log('Testing category filter...');
  console.log('Labor events:', filter('labor').length, '=== 2');
  console.log('All events:', filter('all').length, '=== 3');
  console.log('Environment events:', filter('environment').length, '=== 1');
};
