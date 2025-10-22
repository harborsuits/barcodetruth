export type CategoryKey = 'labor' | 'environment' | 'politics' | 'social';

export interface RatingInput {
  category: CategoryKey;
  score: number; // 1-5
  evidence_event_id?: string;
  evidence_url?: string;
  context_note?: string;
}

export interface RateRequest {
  brand_id: string;
  ratings: RatingInput[];
}

export interface CategoryHistogram {
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
}

export interface CategoryOutlook {
  category: CategoryKey;
  n: number;
  mean_score: number;
  sd: number;
  total_weight: number;
  histogram: CategoryHistogram;
  confidence: 'none' | 'low' | 'medium' | 'high';
  display_score: number;
}

export interface OutlookResponse {
  brand_id: string;
  categories: CategoryOutlook[];
}

export interface TopEvidence {
  event_id: string;
  title: string;
  category: string;
  event_date: string;
  verification: string;
  citation_count: number;
}

export interface TopEvidenceResponse {
  brand_id: string;
  evidence: TopEvidence[];
}
