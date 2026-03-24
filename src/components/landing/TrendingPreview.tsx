import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowRight, Shield, Clock } from "lucide-react";
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
  verified_rate?: number;
  independent_sources?: number;
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

const getScoreColor = (score: number) => {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-danger";
};

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
      .select('brand_id, name, score, events_7d, events_30d, verified_rate, independent_sources, last_event_at, trend_score')
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
        verified_rate: b.verified_rate || 0,
        independent_sources: b.independent_sources || 0,
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
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">TRENDING INVESTIGATIONS</div>
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
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">TRENDING INVESTIGATIONS</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/trending')} className="font-mono text-xs uppercase tracking-wider">
          View All
          <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-3">
        {!trending.length ? (
          <div className="text-center py-8 px-4 bg-elevated-1 border border-border">
            <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <h3 className="font-semibold text-sm mb-1">Building Trending Data</h3>
            <p className="text-xs text-muted-foreground">
              Brand scores and events are being processed. Check back soon.
            </p>
          </div>
        ) : trending.map((brand) => (
          <div
            key={brand.brand_id}
            className="group bg-elevated-1 border border-border p-4 cursor-pointer transition-all duration-150 hover:border-primary/30"
            onClick={() => navigate(`/brand/${brand.brand_id}`)}
          >
            <div className="flex items-center gap-3">
              {/* Score badge */}
              {FEATURES.companyScore && brand.overall_score != null ? (
                <div className={`text-2xl font-bold font-mono min-w-[3ch] text-right ${getScoreColor(brand.overall_score)}`}>
                  {brand.overall_score}
                </div>
              ) : (
                <div className="text-2xl font-bold font-mono min-w-[3ch] text-right text-muted-foreground">—</div>
              )}

              <BrandLogoIcon 
                logoUrl={brand.logo_url} 
                website={brand.website}
                brandName={brand.brand_name}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{brand.brand_name}</h3>
                  <Shield className="h-3.5 w-3.5 text-primary/50 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">TRUST_SCORE</span>
                  {brand.last_event_at && (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(brand.last_event_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
