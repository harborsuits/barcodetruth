// Shared types
export type Severity = "minor" | "moderate" | "severe";
export type Category = "labor" | "environment" | "politics" | "social" | "general";

export interface SeverityInput {
  category: Category;
  source?: "EPA" | "OSHA" | "FEC" | string;
  // canonical impact fields you already store:
  impact_labor?: number | null;
  impact_environment?: number | null;
  impact_politics?: number | null;
  impact_social?: number | null;
  // adapter-specific metrics (optional, from raw_data):
  raw?: Record<string, any> | null;
}

export interface SeverityResult {
  level: Severity;
  reason: string;           // short label to show in UI/tooltips
  badge: "info" | "warn" | "danger";
}

type Thresholds = {
  // maps an absolute "magnitude" (e.g., penalties, tilt %, counts) to a severity level
  toLevel: (input: SeverityInput) => SeverityResult;
};

// ---- Per-source/category thresholds ----

// EPA (Environment)
// We use quarters-with-noncompliance (QNC) when available; else fall back to impact_environment.
const EPA_THRESHOLDS: Thresholds = {
  toLevel: (input) => {
    const qnc = Number(input.raw?.Qtrs_with_NC ?? input.raw?.qnc ?? 0);
    const impact = Number(input.impact_environment ?? 0);

    // Prefer QNC signal when present
    if (qnc >= 4) return { level: "severe", reason: "4+ quarters non-compliance", badge: "danger" };
    if (qnc >= 2) return { level: "moderate", reason: "2–3 quarters non-compliance", badge: "warn" };
    if (qnc >= 1) return { level: "minor", reason: "1 quarter non-compliance", badge: "info" };

    // Fallback to your impact scale (-1…-5)
    if (impact <= -5) return { level: "severe", reason: "Multiple violations", badge: "danger" };
    if (impact <= -3) return { level: "moderate", reason: "Notable violation(s)", badge: "warn" };
    if (impact < 0)   return { level: "minor", reason: "Incident reported", badge: "info" };
    return { level: "minor", reason: "Informational", badge: "info" };
  }
};

// OSHA (Labor)
// Use count of serious/willful/repeat and total penalty when available; else impact_labor.
const OSHA_THRESHOLDS: Thresholds = {
  toLevel: (input) => {
    const serious = Number(input.raw?.nr_serious ?? 0);
    const willful = Number(input.raw?.nr_willful ?? 0);
    const repeat  = Number(input.raw?.nr_repeat ?? 0);
    const penalty = Number(input.raw?.total_current_penalty ?? 0);
    const impact  = Number(input.impact_labor ?? 0);

    if (willful >= 2 || penalty >= 100_000) return { level: "severe", reason: "High penalties / willful", badge: "danger" };
    if (repeat >= 1 || serious >= 3 || penalty >= 25_000) return { level: "moderate", reason: "Serious or repeat", badge: "warn" };
    if (serious >= 1) return { level: "minor", reason: "Serious violation", badge: "info" };

    if (impact <= -5) return { level: "severe", reason: "Severe impact", badge: "danger" };
    if (impact <= -3) return { level: "moderate", reason: "Moderate impact", badge: "warn" };
    if (impact < 0)   return { level: "minor", reason: "Minor impact", badge: "info" };
    return { level: "minor", reason: "Informational", badge: "info" };
  }
};

// FEC (Politics)
// Use tilt_pct if present; else impact_politics.
const FEC_THRESHOLDS: Thresholds = {
  toLevel: (input) => {
    const tiltPct = Number(input.raw?.tilt_pct ?? 0); // 0–100
    const impact  = Number(input.impact_politics ?? 0);

    if (tiltPct >= 85) return { level: "severe", reason: `${tiltPct}% partisan tilt`, badge: "danger" };
    if (tiltPct >= 70) return { level: "moderate", reason: `${tiltPct}% partisan tilt`, badge: "warn" };
    if (tiltPct >= 55) return { level: "minor", reason: `${tiltPct}% partisan tilt`, badge: "info" };

    if (impact <= -5) return { level: "severe", reason: "Severe impact", badge: "danger" };
    if (impact <= -3) return { level: "moderate", reason: "Moderate impact", badge: "warn" };
    if (impact < 0)   return { level: "minor", reason: "Minor impact", badge: "info" };
    return { level: "minor", reason: "Informational", badge: "info" };
  }
};

// Generic fallback (for social/general or unknown sources)
const GENERIC_THRESHOLDS: Thresholds = {
  toLevel: (input) => {
    const byCatImpact =
      input.category === "environment" ? Number(input.impact_environment ?? 0) :
      input.category === "labor"       ? Number(input.impact_labor ?? 0) :
      input.category === "politics"    ? Number(input.impact_politics ?? 0) :
      Number(input.impact_social ?? 0);

    if (byCatImpact <= -5) return { level: "severe", reason: "Severe impact", badge: "danger" };
    if (byCatImpact <= -3) return { level: "moderate", reason: "Moderate impact", badge: "warn" };
    if (byCatImpact < 0)   return { level: "minor", reason: "Minor impact", badge: "info" };
    return { level: "minor", reason: "Informational", badge: "info" };
  }
};

export function computeSeverity(input: SeverityInput): SeverityResult {
  const source = (input.source || "").toUpperCase();

  if (source === "EPA"  || input.category === "environment") return EPA_THRESHOLDS.toLevel(input);
  if (source === "OSHA" || input.category === "labor")       return OSHA_THRESHOLDS.toLevel(input);
  if (source === "FEC"  || input.category === "politics")    return FEC_THRESHOLDS.toLevel(input);

  return GENERIC_THRESHOLDS.toLevel(input);
}
