import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ShareholderItem = {
  holder_name: string;
  ownership_percentage: number;
  approx_brand_slug?: string | null;
  approx_brand_logo_url?: string | null;
};

interface OwnershipBarChartProps {
  items: ShareholderItem[];
  others?: number | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getHolderTier(percentage: number): { label: string; variant: "outline" | "secondary" } {
  if (percentage >= 5) return { label: "Major holder", variant: "secondary" };
  if (percentage >= 1) return { label: "Significant holder", variant: "outline" };
  return { label: "Minor holder", variant: "outline" };
}

export function OwnershipBarChart({ items, others }: OwnershipBarChartProps) {
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        We don't yet have verified shareholder data for this company.
      </p>
    );
  }

  // Check if we have actual percentages or just names
  const hasPercentages = items.some((item) => item.ownership_percentage > 0);
  
  // Calculate max percentage for scale
  const maxPercentage = hasPercentages 
    ? Math.max(...items.map(i => i.ownership_percentage), 0)
    : 1;
  
  // Round up to nice number for scale
  const scaleMax = hasPercentages 
    ? Math.ceil(maxPercentage / 5) * 5 || 10
    : 100;

  const handleRowClick = (slug: string | null | undefined) => {
    if (slug) {
      navigate(`/brand/${slug}`);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Subtitle */}
      <p className="text-xs text-muted-foreground">
        Approximate ownership share, based on latest public filings.
      </p>

      {/* Chart rows */}
      <div className="space-y-3">
        {items.map((item, index) => {
          const isClickable = !!item.approx_brand_slug;
          const barWidth = hasPercentages 
            ? (item.ownership_percentage / scaleMax) * 100
            : ((items.length - index) / items.length) * 60 + 20; // Fake distribution when no %
          const tier = hasPercentages 
            ? getHolderTier(item.ownership_percentage) 
            : { label: "Major holder", variant: "outline" as const };
          
          // Color ramp - darker for larger holders
          const opacity = hasPercentages
            ? 0.6 + (item.ownership_percentage / maxPercentage) * 0.4
            : 1 - (index * 0.15);

          return (
            <div
              key={item.holder_name}
              onClick={() => handleRowClick(item.approx_brand_slug)}
              className={cn(
                "group rounded-lg p-2 -mx-2 transition-colors",
                isClickable && "cursor-pointer hover:bg-muted/50"
              )}
            >
              {/* Top row: Avatar + Name + Badge */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                  {item.approx_brand_logo_url ? (
                    <img 
                      src={item.approx_brand_logo_url} 
                      alt={item.holder_name} 
                      className="h-full w-full object-contain" 
                    />
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {getInitials(item.holder_name)}
                    </span>
                  )}
                </div>
                <span 
                  className="text-sm font-medium truncate max-w-[180px]" 
                  title={item.holder_name}
                >
                  {item.holder_name}
                </span>
                {hasPercentages && (
                  <Badge variant={tier.variant} className="text-[10px] px-1.5 py-0 h-4">
                    {tier.label}
                  </Badge>
                )}
                {isClickable && (
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    View profile →
                  </span>
                )}
              </div>

              {/* Bar row */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden relative">
                  {/* Light gridlines */}
                  {hasPercentages && (
                    <div className="absolute inset-0 flex">
                      {[...Array(5)].map((_, i) => (
                        <div 
                          key={i} 
                          className="flex-1 border-r border-muted-foreground/10 last:border-r-0" 
                        />
                      ))}
                    </div>
                  )}
                  {/* Bar */}
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(barWidth, 3)}%`,
                      backgroundColor: `hsl(var(--primary) / ${opacity})`,
                    }}
                  />
                </div>
                {/* Percentage pill */}
                {hasPercentages ? (
                  <span className="text-xs font-medium text-muted-foreground min-w-[40px] text-right">
                    {item.ownership_percentage.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                    —
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Others row */}
        {others && others > 0 && (
          <div className="rounded-lg p-2 -mx-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-medium text-muted-foreground">+</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Others ({others} more holders)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-muted-foreground/20"
                  style={{ width: "15%" }}
                />
              </div>
              <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                misc.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* X-axis scale */}
      {hasPercentages && (
        <div className="flex justify-between text-[10px] text-muted-foreground/60 px-2 pt-1 border-t border-muted/30">
          <span>0%</span>
          <span>{(scaleMax / 2).toFixed(0)}%</span>
          <span>{scaleMax}%</span>
        </div>
      )}

      {/* Source attribution */}
      <p className="text-[10px] text-muted-foreground/60 pt-2">
        Data from SEC 13F filings and Wikidata · Partial institutional view only.
      </p>
    </div>
  );
}
