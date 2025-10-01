// Test file for events utilities
// Run with: npm test or vitest
// Install vitest with: npm install -D vitest

import { lineFromEvent, topImpacts, attributionPrefix, formatMonthYear } from './events';

// Example test cases - uncomment when vitest is installed
/*
describe('lineFromEvent', () => {
  it('returns correct line for official verification', () => {
    const result = lineFromEvent({ 
      verification: 'official', 
      sources: [{ name: 'FEC', date: '2025-09-15' }] 
    });
    expect(result).toContain('Per FEC');
  });

  it('returns correct line for unverified', () => {
    const result = lineFromEvent({ 
      verification: 'unverified', 
      sources: [{ name: 'Blog', date: '2025-09-15' }] 
    });
    expect(result).toContain('Reported by Blog');
    expect(result).toContain('Not yet corroborated');
  });

  it('returns correct line for corroborated/verified', () => {
    const result = lineFromEvent({ 
      verification: 'corroborated', 
      sources: [{ name: 'Reuters', date: '2025-09-15' }] 
    });
    expect(result).toContain('According to Reuters');
  });

  it('handles missing sources gracefully', () => {
    const result = lineFromEvent({ verification: 'official', sources: [] });
    expect(result).toBe('Source unavailable.');
  });

  it('uses backwards compatible source field', () => {
    const result = lineFromEvent({ 
      verification: 'official', 
      source: { name: 'FEC', date: '2025-09-15' } 
    });
    expect(result).toContain('Per FEC');
  });
});

describe('topImpacts', () => {
  it('sorts impacts by magnitude and trims to limit', () => {
    const result = topImpacts({ labor: -15, social: -5, environment: 3 }, 2);
    expect(result.map(r => r.key)).toEqual(['labor', 'social']);
  });

  it('excludes zero and NaN values', () => {
    const result = topImpacts({ labor: 0, social: NaN, environment: 5 });
    expect(result.length).toBe(1);
    expect(result[0].key).toBe('environment');
  });

  it('returns empty array for no impact', () => {
    const result = topImpacts(undefined);
    expect(result).toEqual([]);
  });

  it('handles positive and negative impacts', () => {
    const result = topImpacts({ labor: -10, environment: 12, politics: -3 }, 2);
    expect(result.map(r => r.key)).toEqual(['environment', 'labor']);
  });
});

describe('attributionPrefix', () => {
  it('returns correct prefix for official', () => {
    expect(attributionPrefix('official')).toBe('Per');
  });

  it('returns correct prefix for unverified', () => {
    expect(attributionPrefix('unverified')).toBe('Reported by');
  });

  it('returns correct prefix for corroborated', () => {
    expect(attributionPrefix('corroborated')).toBe('According to');
  });

  it('defaults to "According to" for undefined', () => {
    expect(attributionPrefix(undefined)).toBe('According to');
  });
});

describe('formatMonthYear', () => {
  it('formats valid ISO date correctly', () => {
    const result = formatMonthYear('2025-09-15');
    expect(result).toMatch(/Sep 2025/);
  });

  it('returns "Date unknown" for undefined', () => {
    expect(formatMonthYear(undefined)).toBe('Date unknown');
  });

  it('returns original string for invalid date', () => {
    expect(formatMonthYear('not-a-date')).toBe('not-a-date');
  });
});
*/

// Manual verification tests (run these in browser console)
export const runManualTests = () => {
  console.log('Testing lineFromEvent...');
  console.log(lineFromEvent({ verification: 'official', sources: [{ name: 'FEC', date: '2025-09-15' }] }));
  console.log(lineFromEvent({ verification: 'unverified', sources: [{ name: 'Blog', date: '2025-09-15' }] }));
  console.log(lineFromEvent({ verification: 'corroborated', sources: [{ name: 'Reuters', date: '2025-09-15' }] }));
  
  console.log('\nTesting topImpacts...');
  console.log(topImpacts({ labor: -15, social: -5, environment: 3 }, 2));
  
  console.log('\nTesting attributionPrefix...');
  console.log(attributionPrefix('official'), '=== Per');
  console.log(attributionPrefix('unverified'), '=== Reported by');
  console.log(attributionPrefix('corroborated'), '=== According to');
  
  console.log('\nTesting formatMonthYear...');
  console.log(formatMonthYear('2025-09-15'));
  console.log(formatMonthYear(undefined));
};
