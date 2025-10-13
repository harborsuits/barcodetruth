export type VerificationLevel = 'official' | 'corroborated' | 'unverified';

export type EvidenceItem = {
  id: string;
  event_id: string;
  brand_id: string;
  category: 'labor' | 'environment' | 'politics' | 'social';
  source_name: string;
  source_url: string | null;
  archive_url: string | null;
  canonical_url?: string | null;
  source_date: string | null;
  snippet?: string | null;
  verification: VerificationLevel;
  domain_owner?: string;
  domain_kind?: string;
  link_kind?: 'article' | 'database' | 'homepage';
  credibility_tier?: 'official' | 'reputable' | 'local' | 'unknown';
  ai_summary?: string | null;
  article_title?: string | null;
};

export type CategoryProofSummary = {
  component: string;
  base: number;
  base_reason: string;
  window_delta: number;
  value: number;
  confidence: number;
  evidence_count: number;
  verified_count: number;
  independent_owners: number;
  proof_required: boolean;
  syndicated_hidden_count: number;
};

export type BrandProofResponse = {
  brandId: string;
  brandName: string;
  updatedAt: string;
  totals: {
    totalScore: number;
    confidence: number;
  };
  breakdown: CategoryProofSummary[];
  evidence: Record<string, EvidenceItem[]>;
  evidence_full: Record<string, EvidenceItem[]>;
};
