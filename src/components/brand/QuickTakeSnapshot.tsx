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

  if (isLoading) {
    return (
      <div className="h-32 rounded-2xl border bg-gradient-to-r from-emerald-50 via-amber-50 to-rose-50">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (!data) return null;

  // Detect baseline: all scores at 50 or null means no real data
  const _isBaseline = 
    (data.composite_score === null || data.composite_score === 50) &&
    (data.labor_score === null || data.labor_score === 50) &&
    (data.environment_score === null || data.environment_score === 50) &&
    (data.politics_score === null || data.politics_score === 50) &&
    (data.social_score === null || data.social_score === 50);

  const comp = _isBaseline ? null : data.composite_score;
  
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
          {comp !== null ? (
            <>
              <div className="text-4xl font-bold text-foreground">{comp}</div>
              <div className="text-xs text-muted-foreground mt-1">Overall Rating</div>
            </>
          ) : (
            <>
              <div className="text-xl font-semibold text-muted-foreground">Analyzing</div>
              <div className="text-xs text-muted-foreground mt-1">
                We're processing public records for this brand
              </div>
            </>
          )}
        </div>
        {!_isBaseline && (
          <div className="flex gap-2 flex-wrap">
            <MetricPill label="Labor" value={data.labor_score} />
            <MetricPill label="Environment" value={data.environment_score} />
          </div>
        )}
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        {_isBaseline
          ? "Profile building as more verified data is reviewed"
          : <>Snapshot based on current verified data • Updated {data.last_updated ? new Date(data.last_updated).toLocaleDateString() : "—"}</>
        }
      </div>
    </div>
  );
}
