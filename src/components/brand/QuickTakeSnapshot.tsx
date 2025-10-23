import { useRpc } from "@/hooks/useRpc";
import { Skeleton } from "@/components/ui/skeleton";

interface QuickTakeData {
  composite_score: number | null;
  labor_score: number | null;
  environment_score: number | null;
  politics_score: number | null;
  social_score: number | null;
  last_updated: string | null;
}

interface QuickTakeSnapshotProps {
  brandId: string;
}

export function QuickTakeSnapshot({ brandId }: QuickTakeSnapshotProps) {
  const { data, isLoading } = useRpc<QuickTakeData>("rpc_get_brand_quick_take", {
    p_brand_id: brandId,
  });

  if (isLoading) {
    return (
      <div className="h-32 rounded-2xl border bg-gradient-to-r from-emerald-50 via-amber-50 to-rose-50">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (!data) return null;

  const comp = data.composite_score ?? 50;
  
  // Helper to render mini metric pills
  const MetricPill = ({ label, value }: { label: string; value?: number | null }) => (
    <div className="rounded-full px-3 py-1 text-xs bg-white/70 backdrop-blur-sm border border-white/40">
      <span className="font-medium text-muted-foreground">{label}:</span>{" "}
      <span className="font-semibold text-foreground">{value ?? "—"}</span>
    </div>
  );

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-r from-emerald-50 via-amber-50 to-rose-50 border-2 border-border/50 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Quick Take</div>
          <div className="text-4xl font-bold text-foreground">{comp}</div>
          <div className="text-xs text-muted-foreground mt-1">Overall Rating</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <MetricPill label="Labor" value={data.labor_score} />
          <MetricPill label="Environment" value={data.environment_score} />
        </div>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        Snapshot based on current verified data •{" "}
        Updated {data.last_updated ? new Date(data.last_updated).toLocaleDateString() : "—"}
      </div>
    </div>
  );
}
