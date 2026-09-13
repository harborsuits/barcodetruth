// Reviewed September 13, 2026 against the linked primary sources. Records apply
// only to this exact catalog entity. No propagation to parent/subsidiary brands.
export const reviewedCompanyActions = [
  {
    id: 'kraftheinz-pac-2024', brandId: 'dca50aec-af0d-4afb-812a-15ef77747b69', topic: 'politics',
    actor: 'KraftHeinzPAC', kind: 'Company-published PAC disclosure', period: '2024 calendar year', reviewedAt: '2026-09-13',
    title: 'The disclosed PAC contributions include committees from both major parties.',
    detail: 'The 2024 report lists $15,000 to the National Republican Congressional Committee and $10,000 to the Democratic Congressional Campaign Committee. These are two entries, not totals for each party.',
    limit: 'These are PAC contributions, not company treasury spending or personal donations. This historical report does not establish a current political position.',
    source: 'https://www.kraftheinzcompany.com/pdf/2024_Political_Contributions.pdf',
    additionalSource: 'https://www.fec.gov/data/committee/C00077701/', additionalLabel: 'See the PAC’s FEC record',
  },
  {
    id: 'kraftheinz-equal-opportunity', brandId: 'dca50aec-af0d-4afb-812a-15ef77747b69', topic: 'inclusion',
    actor: 'The Kraft Heinz Company', kind: 'Stated employment policy', period: 'Publication date not provided', reviewedAt: '2026-09-13',
    title: 'Its employment policy includes sexual orientation and gender identity.',
    detail: 'The company’s equal-employment page says qualified applicants are considered without regard to sexual orientation or gender identity or expression, among other characteristics.',
    limit: 'This establishes a stated hiring policy. It does not establish how consistently the policy is implemented or the company’s position on every LGBTQ+ issue.',
    source: 'https://www.kraftheinzcompany.com/eeo.html', additionalSource: null, additionalLabel: null,
  },
] as const;
