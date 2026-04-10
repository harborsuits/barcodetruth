export function getConfidenceLabel(pct: number) {
  if (pct < 40) return { label: "Early", className: "text-muted-foreground" };
  if (pct < 70) return { label: "Growing", className: "text-yellow-600" };
  return { label: "High", className: "text-green-600" };
}
