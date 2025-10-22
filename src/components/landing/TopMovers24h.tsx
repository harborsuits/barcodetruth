import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { FEATURES } from "@/config/features";
import { OutlookConfidenceBadge } from "@/components/brand/OutlookConfidenceBadge";

interface Mover {
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  website: string | null;
  score_now: number;
  score_24h_ago: number;
  delta_24h: number;
  last_updated: string;
}

// Mini logo with instant fallback
function MoverLogo({ logoUrl, website, brandName }: { 
  logoUrl: string | null; 
  website: string | null;
  brandName: string;
}) {
  const displayLogo = useBrandLogo(logoUrl, website);
  
  if (displayLogo) {
    return (
      <img 
        src={displayLogo} 
        alt={`${brandName} logo`}
        className="w-8 h-8 rounded object-contain flex-shrink-0"
        loading="lazy"
      />
    );
  }
  
  return (
    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-medium">{brandName[0]}</span>
    </div>
  );
}

export function TopMovers24h() {
  const navigate = useNavigate();

  const { data: movers, isLoading } = useQuery({
    queryKey: ['top-movers-24h'],
    enabled: FEATURES.companyScore, // Only fetch if company scores are enabled
    queryFn: async () => {
      // First get movers
      const { data: moverData, error: moverError } = await supabase
        .from("brand_score_movers_24h")
        .select("brand_id, brand_name, logo_url, score_now, score_24h_ago, delta_24h, last_updated")
        .limit(6);
      
      if (moverError) throw moverError;
      if (!moverData || moverData.length === 0) return [];
      
      // Then fetch websites for fallback logos
      const brandIds = moverData.map(m => m.brand_id);
      const { data: brandData } = await supabase
        .from('brands')
        .select('id, website')
        .in('id', brandIds);
      
      const websiteMap = (brandData || []).reduce((acc, b) => {
        acc[b.id] = b.website;
        return acc;
      }, {} as Record<string, string | null>);
      
      return moverData.map(m => ({
        ...m,
        website: websiteMap[m.brand_id] || null
      })) as Mover[];
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Don't show this section if company scores are disabled
  if (!FEATURES.companyScore) {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!movers || movers.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Top Movers (24h)</h3>
        <span className="text-xs text-muted-foreground">Score changes</span>
      </div>
      <ul className="space-y-3">
        {movers.map((mover) => {
          const isPositive = mover.delta_24h >= 0;
          return (
            <li 
              key={mover.brand_id} 
              className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/brand/${mover.brand_id}`)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <MoverLogo 
                  logoUrl={mover.logo_url}
                  website={mover.website}
                  brandName={mover.brand_name}
                />
                <span className="font-medium truncate">{mover.brand_name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm text-muted-foreground tabular-nums">
                  {Math.round(mover.score_24h_ago)}
                </span>
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger" />
                )}
                <span className={`text-sm font-semibold tabular-nums ${
                  isPositive ? "text-success" : "text-danger"
                }`}>
                  {Math.round(mover.score_now)} ({isPositive ? "+" : ""}{Math.round(mover.delta_24h)})
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
