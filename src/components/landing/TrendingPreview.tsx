import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { FEATURES } from "@/config/features";

interface TrendingBrand {
  brand_id: string;
  brand_name: string;
  logo_url?: string;
  website?: string;
  overall_score: number | null;
  event_count?: number;
  last_event_at?: string;
}

function BrandLogoIcon({ logoUrl, website, brandName }: { 
  logoUrl?: string; 
  website?: string;
  brandName: string;
}) {
  const displayLogo = useBrandLogo(logoUrl || null, website || null);
  
  return (
    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-muted/40 rounded-lg">
      {displayLogo ? (
        <img 
          src={displayLogo} 
          alt={`${brandName} logo`}
          loading="lazy"
          className="max-w-full max-h-full object-contain p-1"
        />
      ) : (
        <span className="text-lg font-bold">
          {brandName?.[0]?.toUpperCase() ?? 'B'}
        </span>
      )}
    </div>
  );
}

function getScoreBadge(score: number | null): { label: string; className: string } {
  if (score === null) return { label: "—", className: "text-muted-foreground" };
  if (score >= 65) return { label: "Good", className: "text-success" };
  if (score >= 40) return { label: "Mixed", className: "text-warning" };
  return { label: "Avoid", className: "text-destructive" };
}

export function TrendingPreview() {
  const navigate = useNavigate();
  const [trending, setTrending] = useState<TrendingBrand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    try {
      const baseUrl = `${supabase.storage.from('snapshots').getPublicUrl('').data.publicUrl}`;
      const latestRes = await fetch(`${baseUrl}latest.json`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (latestRes.ok) {
        const { version } = await latestRes.json();
        const trendingRes = await fetch(`${baseUrl}v/${version}/trending.json`, {
          cache: 'force-cache',
          headers: { 'Cache-Control': 'public, max-age=900, immutable' }
        });
        
        if (trendingRes.ok) {
          const snapshot = await trendingRes.json();
          setTrending(snapshot.brands?.slice(0, 5) || []);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.log('Snapshot not available, using live data', e);
    }

    const { data: trendingData } = await supabase
      .from('brand_trending')
      .select('brand_id, name, score, events_7d, events_30d, last_event_at, trend_score')
      .limit(5);

    if (trendingData && trendingData.length) {
      const brandIds = trendingData.map(b => b.brand_id);
      let brandDataMap: Record<string, { logo_url: string | null; website: string | null }> = {};
      if (brandIds.length > 0) {
        const { data: brandData } = await supabase
          .from('brands')
          .select('id, logo_url, website')
          .in('id', brandIds);

        brandDataMap = (brandData || []).reduce((acc, b) => {
          acc[b.id] = { logo_url: b.logo_url, website: b.website };
          return acc;
        }, {} as Record<string, { logo_url: string | null; website: string | null }>);
      }

      setTrending(trendingData.map((b: any) => ({
        brand_id: b.brand_id,
        brand_name: b.name,
        logo_url: brandDataMap[b.brand_id]?.logo_url,
        website: brandDataMap[b.brand_id]?.website,
        event_count: b.events_30d || 0,
        overall_score: b.score ?? null,
        last_event_at: b.last_event_at
      })));
      setLoading(false);
      return;
    }

    setTrending([]);
    setLoading(false);
  };

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Popular Brands</div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Popular Brands</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/trending')} className="text-xs text-muted-foreground">
          View All
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-2">
        {!trending.length ? (
          <div className="text-center py-8 px-4 bg-elevated-1 border border-border rounded-lg">
            <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <h3 className="font-semibold text-sm mb-1">Building trending data</h3>
            <p className="text-xs text-muted-foreground">
              Brand scores are being processed. Check back soon.
            </p>
          </div>
        ) : trending.map((brand) => {
          const badge = getScoreBadge(brand.overall_score);
          return (
            <div
              key={brand.brand_id}
              className="group bg-elevated-1 border border-border p-4 rounded-lg cursor-pointer transition-all duration-150 hover:border-primary/30"
              onClick={() => navigate(`/brand/${brand.brand_id}`)}
            >
              <div className="flex items-center gap-3">
                <BrandLogoIcon 
                  logoUrl={brand.logo_url} 
                  website={brand.website}
                  brandName={brand.brand_name}
                />

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{brand.brand_name}</h3>
                  {brand.last_event_at && (
                    <span className="text-[11px] text-muted-foreground">
                      Updated {new Date(brand.last_event_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {FEATURES.companyScore && brand.overall_score != null ? (
                  <span className={`text-sm font-bold ${badge.className}`}>
                    {badge.label}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
