export interface ConfidenceMeta {
  label: string;
  level: 'none' | 'low' | 'med' | 'high';
  color: string;
}

export function calculateConfidence(
  events: number,
  verifiedRate: number,
  sources: number
): number {
  return Math.min(
    1,
    0.60 * Math.log(1 + events) / Math.log(21) + 
    0.25 * verifiedRate + 
    0.15 * Math.min(sources / 3, 1)
  );
}

export function confidenceMeta(
  events: number, 
  verifiedRate: number, 
  sources: number
): ConfidenceMeta {
  const w = calculateConfidence(events, verifiedRate, sources);
  
  if (events === 0) {
    return { 
      label: 'No data', 
      level: 'none',
      color: 'text-destructive' 
    };
  }
  
  if (w < 0.35) {
    return { 
      label: 'Limited', 
      level: 'low',
      color: 'text-warning' 
    };
  }
  
  if (w < 0.70) {
    return { 
      label: 'Moderate', 
      level: 'med',
      color: 'text-primary' 
    };
  }
  
  return { 
    label: 'Strong', 
    level: 'high',
    color: 'text-success' 
  };
}

export function confidencePercentage(
  events: number,
  verifiedRate: number,
  sources: number
): number {
  return Math.round(calculateConfidence(events, verifiedRate, sources) * 100);
}
