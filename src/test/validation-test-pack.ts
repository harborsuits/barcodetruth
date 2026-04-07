/**
 * 25-Product Validation Test Pack
 * 
 * Purpose: Repeatable QA loop for scan-result quality.
 * Run manually or extend into automated tests.
 * 
 * Categories:
 *   NEGATIVE  – brands with known negative signals, score should be < 40
 *   NEUTRAL   – brands with mixed/moderate evidence, score 40-60
 *   POSITIVE  – brands with positive evidence, score > 60
 *   THIN      – brands with < 5 events, should show "Limited Data" or "Analyzing"
 *   EDGE      – mismatch traps, store brands, or zero-data products
 */

export interface ValidationProduct {
  barcode: string;
  expectedBrand: string;
  expectedParent: string | null;
  category: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | 'THIN' | 'EDGE';
  currentScore: number | null;
  currentEvents: number;
  notes: string;
}

export const VALIDATION_TEST_PACK: ValidationProduct[] = [
  // ─── NEGATIVE (should score < 40) ───
  {
    barcode: '0023700016270',
    expectedBrand: 'Tyson Foods',
    expectedParent: 'Tyson Foods Inc.',
    category: 'NEGATIVE',
    currentScore: 14,
    currentEvents: 59,
    notes: 'Strong negative labor signal (score_labor=2). Anchor negative brand.',
  },
  {
    barcode: '0099482471446',
    expectedBrand: 'Whole Foods Market',
    expectedParent: 'Amazon',
    category: 'NEGATIVE',
    currentScore: 8,
    currentEvents: 140,
    notes: 'Very low score driven by social=0. Verify Amazon parent renders.',
  },
  {
    barcode: '000000100920',
    expectedBrand: 'Nestlé',
    expectedParent: 'Nestlé S.A.',
    category: 'NEGATIVE',
    currentScore: 28,
    currentEvents: 171,
    notes: 'High event count, social=13. Should clearly show negative verdict.',
  },
  {
    barcode: '000000100300',
    expectedBrand: 'Costco',
    expectedParent: 'Costco Wholesale Corporation',
    category: 'NEGATIVE',
    currentScore: 25,
    currentEvents: 88,
    notes: 'labor=32, social=22. Strong negative with good evidence depth.',
  },
  {
    barcode: '000000100960',
    expectedBrand: 'Oreo',
    expectedParent: 'Mondelez',
    category: 'NEGATIVE',
    currentScore: 37,
    currentEvents: 34,
    notes: 'Sub-brand of Mondelez. Verify parent attribution, not just P&G.',
  },

  // ─── NEUTRAL (score 40-60) ───
  {
    barcode: '0021000052387',
    expectedBrand: 'Kraft Heinz',
    expectedParent: 'The Kraft Heinz Company',
    category: 'NEUTRAL',
    currentScore: 45,
    currentEvents: 132,
    notes: 'High evidence depth. Score spread across dimensions.',
  },
  {
    barcode: '000000101040',
    expectedBrand: 'Procter & Gamble',
    expectedParent: 'Procter & Gamble Co.',
    category: 'NEUTRAL',
    currentScore: 51,
    currentEvents: 70,
    notes: 'Parent company. Should show full profile with logo.',
  },
  {
    barcode: '0016000226364',
    expectedBrand: 'General Mills',
    expectedParent: null,
    category: 'NEUTRAL',
    currentScore: 50,
    currentEvents: 34,
    notes: 'Near-baseline but with enough events. Should show honest neutral.',
  },
  {
    barcode: '0012000163135',
    expectedBrand: 'Pepsi',
    expectedParent: 'PepsiCo',
    category: 'NEUTRAL',
    currentScore: 49,
    currentEvents: 31,
    notes: 'Sub-brand of PepsiCo. Verify parent renders.',
  },
  {
    barcode: '000000100380',
    expectedBrand: 'Doritos',
    expectedParent: 'PepsiCo',
    category: 'NEUTRAL',
    currentScore: 40,
    currentEvents: 57,
    notes: 'Border of neutral/negative. labor=38. Good edge test.',
  },

  // ─── POSITIVE (score > 60) ───
  {
    barcode: '0859581006532',
    expectedBrand: 'Unilever',
    expectedParent: 'Unilever PLC',
    category: 'POSITIVE',
    currentScore: 68,
    currentEvents: 137,
    notes: 'Highest-scoring major brand. politics=89, social=79. But labor=32.',
  },
  {
    barcode: '000000100400',
    expectedBrand: 'Dove',
    expectedParent: 'Unilever',
    category: 'POSITIVE',
    currentScore: 62,
    currentEvents: 7,
    notes: 'Just above 5-event threshold. politics=74, social=66.',
  },
  {
    barcode: '000000100420',
    expectedBrand: 'Estée Lauder',
    expectedParent: 'Estée Lauder Companies',
    category: 'POSITIVE',
    currentScore: 58,
    currentEvents: 91,
    notes: 'Borderline positive. politics=69. High event count.',
  },

  // ─── THIN DATA (< 5 events, should suppress score) ───
  {
    barcode: '01216606',
    expectedBrand: 'Mountain Dew',
    expectedParent: 'PepsiCo',
    category: 'THIN',
    currentScore: 52,
    currentEvents: 2,
    notes: 'Only 2 events. Must show "Limited Data", NOT a verdict.',
  },
  {
    barcode: '0028400070942',
    expectedBrand: "Lay's",
    expectedParent: 'PepsiCo',
    category: 'THIN',
    currentScore: 57,
    currentEvents: 0,
    notes: 'Zero events. Must show analyzing/limited data.',
  },
  {
    barcode: '0028400516310',
    expectedBrand: 'Frito-Lay',
    expectedParent: 'PepsiCo',
    category: 'THIN',
    currentScore: 57,
    currentEvents: 0,
    notes: 'Zero events. Inheriting PepsiCo score only.',
  },
  {
    barcode: '0048500205723',
    expectedBrand: 'Tropicana',
    expectedParent: 'PepsiCo',
    category: 'THIN',
    currentScore: 57,
    currentEvents: 0,
    notes: 'Zero events. Should suppress score.',
  },
  {
    barcode: '0030000572429',
    expectedBrand: 'Quaker',
    expectedParent: 'PepsiCo',
    category: 'THIN',
    currentScore: 50,
    currentEvents: 0,
    notes: 'Zero events. PepsiCo sub-brand with no direct evidence.',
  },
  {
    barcode: '0074570014002',
    expectedBrand: 'Häagen-Dazs',
    expectedParent: 'General Mills',
    category: 'THIN',
    currentScore: 50,
    currentEvents: 0,
    notes: 'Zero events. Verify graceful thin-data handling.',
  },

  // ─── EDGE CASES (mismatch traps, store brands, unknown) ───
  {
    barcode: '0078742229539',
    expectedBrand: 'Great Value',
    expectedParent: 'Walmart',
    category: 'EDGE',
    currentScore: 50,
    currentEvents: 0,
    notes: 'Walmart store brand. Should resolve to Great Value, show Walmart parent.',
  },
  {
    barcode: '0096619170500',
    expectedBrand: 'Kirkland Signature',
    expectedParent: 'Costco',
    category: 'EDGE',
    currentScore: 50,
    currentEvents: 0,
    notes: 'Costco store brand. Verify parent attribution.',
  },
  {
    barcode: '000000100120',
    expectedBrand: "Ben & Jerry's",
    expectedParent: 'Unilever',
    category: 'EDGE',
    currentScore: 63,
    currentEvents: 0,
    notes: 'Zero direct events but inherits Unilever. Good inheritance test.',
  },
  {
    barcode: '0042272003525',
    expectedBrand: "Amy's",
    expectedParent: null,
    category: 'EDGE',
    currentScore: 50,
    currentEvents: 0,
    notes: 'Independent brand with no data. Should show analyzing cleanly.',
  },
  {
    barcode: '0602652419317',
    expectedBrand: 'KIND',
    expectedParent: null,
    category: 'EDGE',
    currentScore: 50,
    currentEvents: 0,
    notes: 'Independent snack brand. Zero events. Clean unknown test.',
  },
  {
    barcode: '9999999999999',
    expectedBrand: 'UNKNOWN',
    expectedParent: null,
    category: 'EDGE',
    currentScore: null,
    currentEvents: 0,
    notes: 'Completely fake barcode. Must show unknown-product fallback, not crash.',
  },
];

/**
 * Expected behaviors by category:
 * 
 * NEGATIVE:  Score visible, verdict "Avoid" or "Mixed", red/yellow badge, evidence list
 * NEUTRAL:   Score visible, verdict "Mixed", yellow badge, evidence list
 * POSITIVE:  Score visible, verdict "Good" or "Mixed", green/yellow badge, evidence list  
 * THIN:      Score suppressed, "Limited Data" or "Analyzing" label, metadata still shown
 * EDGE:      Graceful fallback, no crashes, parent attribution correct if known
 */
