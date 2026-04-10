type BuildReasonInputs = {
  scores?: {
    score_labor?: number | null;
    score_environment?: number | null;
    score_politics?: number | null;
    score_social?: number | null;
    overall?: number | null;
  };
  evidenceCounts?: Record<string, number>;
  parentName?: string | null;
  brandName?: string;
};

export function buildReasons({ scores, evidenceCounts = {}, parentName, brandName }: BuildReasonInputs): string[] {
  const reasons: string[] = [];
  const s = scores || {};

  if (s.score_labor != null && s.score_labor < 45) {
    const c = evidenceCounts.labor || 0;
    reasons.push(c > 0 ? `${c} labor/workplace safety issue${c !== 1 ? "s" : ""} on record` : "Below-average labor practices record");
  } else if ((evidenceCounts.labor ?? 0) > 0) {
    reasons.push(`${evidenceCounts.labor} labor violations`);
  }

  if (s.score_environment != null && s.score_environment < 45) {
    const c = evidenceCounts.environment || 0;
    reasons.push(c > 0 ? `${c} environmental compliance issue${c !== 1 ? "s" : ""} flagged` : "Environmental record needs improvement");
  } else if ((evidenceCounts.environment ?? 0) > 0) {
    reasons.push(`${evidenceCounts.environment} environmental incidents`);
  }

  if (s.score_politics != null && s.score_politics < 45) {
    reasons.push("Significant political lobbying or donation exposure");
  }

  if (s.score_social != null && s.score_social < 45) {
    reasons.push("Social responsibility concerns identified");
  }

  if (parentName && parentName !== brandName) {
    reasons.push(`Owned by ${parentName} — a large parent company`);
  }

  if (reasons.length === 0 && s.overall != null) {
    if (s.overall >= 65) reasons.push("No major issues found in checked sources");
    else reasons.push("Mixed record across multiple categories");
  }

  return reasons.slice(0, 3);
}
