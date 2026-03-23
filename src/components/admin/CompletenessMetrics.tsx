import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Building2, FileText, ArrowRightLeft, ScanLine, HelpCircle, Tags } from "lucide-react";

interface Metrics {
  total_brands: number;
  brands_with_ownership: number;
  brands_with_evidence: number;
  brands_with_alternatives: number;
  brands_with_scores: number;
  scan_total: number;
  scan_resolved: number;
  unknown_barcodes_pending: number;
  brands_with_attributes: number;
}

export function CompletenessMetrics() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-completeness-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_brand_completeness_metrics" as any);
      if (error) throw error;
      return data as unknown as Metrics;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Completeness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted/50 animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const pctOwnership = metrics.total_brands > 0
    ? Math.round((metrics.brands_with_ownership / metrics.total_brands) * 100)
    : 0;
  const pctEvidence = metrics.total_brands > 0
    ? Math.round((metrics.brands_with_evidence / metrics.total_brands) * 100)
    : 0;
  const pctAlternatives = metrics.total_brands > 0
    ? Math.round((metrics.brands_with_alternatives / metrics.total_brands) * 100)
    : 0;
  const scanResolutionRate = metrics.scan_total > 0
    ? Math.round((metrics.scan_resolved / metrics.scan_total) * 100)
    : 0;

  const rows = [
    {
      icon: ScanLine,
      label: "Scan Resolution Rate",
      value: `${scanResolutionRate}%`,
      detail: `${metrics.scan_resolved} / ${metrics.scan_total} scans`,
      progress: scanResolutionRate,
      color: "text-cyan-500",
    },
    {
      icon: Building2,
      label: "Brands with Ownership",
      value: `${pctOwnership}%`,
      detail: `${metrics.brands_with_ownership} / ${metrics.total_brands}`,
      progress: pctOwnership,
      color: "text-blue-500",
    },
    {
      icon: FileText,
      label: "Brands with Evidence",
      value: `${pctEvidence}%`,
      detail: `${metrics.brands_with_evidence} / ${metrics.total_brands}`,
      progress: pctEvidence,
      color: "text-green-500",
    },
    {
      icon: ArrowRightLeft,
      label: "Brands with Alternatives",
      value: `${pctAlternatives}%`,
      detail: `${metrics.brands_with_alternatives} / ${metrics.total_brands}`,
      progress: pctAlternatives,
      color: "text-purple-500",
    },
    {
      icon: Tags,
      label: "Brands with Attributes",
      value: String(metrics.brands_with_attributes),
      detail: `tagged brands`,
      progress: metrics.total_brands > 0
        ? Math.round((metrics.brands_with_attributes / metrics.total_brands) * 100)
        : 0,
      color: "text-amber-500",
    },
    {
      icon: HelpCircle,
      label: "Unknown Barcodes Pending",
      value: String(metrics.unknown_barcodes_pending),
      detail: "awaiting enrichment",
      progress: null,
      color: "text-red-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Data Completeness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <row.icon className={`h-4 w-4 ${row.color}`} />
                <span className="text-sm font-medium">{row.label}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold">{row.value}</span>
                <span className="text-xs text-muted-foreground ml-1">({row.detail})</span>
              </div>
            </div>
            {row.progress !== null && (
              <Progress value={row.progress} className="h-1.5" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
