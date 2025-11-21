import { useRpc } from "@/hooks/useRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

const RATING_THRESHOLD = 25;

export function QuickTakeSnapshot({ brandId }: QuickTakeSnapshotProps) {
  const { data, isLoading } = useRpc<QuickTakeData>("rpc_get_brand_quick_take", {
    p_brand_id: brandId,
  });

  // Fetch community ratings to determine if we have enough data
  const { data: outlook, isLoading: outlookLoading } = useQuery({
    queryKey: ['community-outlook', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('community-outlook', {
        body: { brand_id: brandId },
      });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || outlookLoading) {
    return (
      <div className="h-32 rounded-2xl border bg-gradient-to-r from-emerald-50 via-amber-50 to-rose-50">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (!data) return null;

  // Calculate total community ratings across all categories
  const totalRatings = outlook?.categories?.reduce((sum: number, cat: any) => sum + (cat.n || 0), 0) || 0;
  const hasEnoughRatings = totalRatings >= RATING_THRESHOLD;

  const comp = data.composite_score ?? 50;
  
  // Helper to render mini metric pills
  const MetricPill = ({ label, value }: { label: string; value?: number | null }) => (
    <div className="rounded-full px-3 py-1 text-xs bg-white/70 backdrop-blur-sm border border-white/40">
      <span className="font-medium text-muted-foreground">{label}:</span>{" "}
      <span className="font-semibold text-foreground">
        {hasEnoughRatings ? (value ?? "—") : "—"}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-r from-emerald-50 via-amber-50 to-rose-50 border-2 border-border/50 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Quick Take</div>
          <div className="text-4xl font-bold text-foreground">
            {hasEnoughRatings ? comp : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {hasEnoughRatings ? "Overall Rating" : "Monitoring in progress"}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <MetricPill label="Labor" value={data.labor_score} />
          <MetricPill label="Environment" value={data.environment_score} />
        </div>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        {hasEnoughRatings ? (
          <>
            Snapshot based on current verified data •{" "}
            Updated {data.last_updated ? new Date(data.last_updated).toLocaleDateString() : "—"}
            {data.composite_score === null && " • Baseline until more events arrive"}
          </>
        ) : (
          <>
            Awaiting sufficient community ratings ({totalRatings}/{RATING_THRESHOLD}) •{" "}
            Share your view below to help establish a rating
          </>
        )}
      </div>
    </div>
  );
}
