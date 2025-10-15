interface Coverage {
  events_90d?: number;
  events_365d?: number;
  independent_sources?: number;
}

interface ConfidenceChipProps {
  coverage: Coverage;
}

function getConfidenceLevel(e90 = 0, uniq = 0, e365 = 0) {
  if (e365 === 0) {
    return { 
      level: "none" as const, 
      label: "No recent evidence",
      className: "bg-muted text-muted-foreground"
    };
  }
  if (e90 >= 6 && uniq >= 5) {
    return { 
      level: "high" as const, 
      label: "High confidence",
      className: "bg-success/10 text-success"
    };
  }
  if (e90 >= 2 && uniq >= 3) {
    return { 
      level: "medium" as const, 
      label: "Medium confidence",
      className: "bg-warn/10 text-warn"
    };
  }
  return { 
    level: "low" as const, 
    label: "Low confidence",
    className: "bg-danger/10 text-danger"
  };
}

export function ConfidenceChip({ coverage }: ConfidenceChipProps) {
  const confidence = getConfidenceLevel(
    coverage.events_90d ?? 0,
    coverage.independent_sources ?? 0,
    coverage.events_365d ?? 0
  );

  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${confidence.className}`}>
      {confidence.label}
    </span>
  );
}
