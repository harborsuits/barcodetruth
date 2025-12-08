import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { confidenceMeta } from "@/lib/confidence";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { FEATURES } from "@/config/features";
import { OutlookConfidenceBadge } from "@/components/brand/OutlookConfidenceBadge";

interface TrendingBrand {
  brand_id: string;
  brand_name: string;
  logo_url?: string;
  website?: string;
  overall_score: number | null;
  event_count?: number;
  confidence?: number;
  verified_rate?: number;
  independent_sources?: number;
  last_event_at?: string;
  recent_event?: {
    title: string;
    category: string;
    verification: string;
    source_count: number;
  };
}

// Small logo icon with instant fallback
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

export function TrendingPreview() {
  const navigate = useNavigate();
  const [trending, setTrending] = useState<TrendingBrand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    try {
      // Try snapshot first with proper cache headers
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

    // Use brand_trending view for optimized trending data
    const { data: trendingData } = await supabase
      .from('brand_trending')
      .select('brand_id, name, score, events_7d, events_30d, verified_rate, independent_sources, last_event_at, trend_score')
      .limit(5);

    if (trendingData && trendingData.length) {
      // Fetch logos and websites for these brands
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
        confidence: null, // Not available in view
        verified_rate: b.verified_rate || 0,
        independent_sources: b.independent_sources || 0,
        last_event_at: b.last_event_at
      })));
      setLoading(false);
      return;
    }

    // No fallback - only show verified brands
    setTrending([]);
    setLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  if (loading) {
    return (
      <section>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Trending Now</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/trending')}>
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {!trending.length ? (
            <div className="text-center py-8 px-4">
              <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <h3 className="font-semibold mb-2">Building Trending Data</h3>
              <p className="text-sm text-muted-foreground">
                Brand scores and events are being processed. Check back soon to see trending brands.
              </p>
            </div>
          ) : trending.map((brand) => (
            <div
              key={brand.brand_id}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 cursor-pointer transition-all duration-150 ease-[var(--ease)] hover:shadow-[var(--shadow-md)]"
              onClick={() => navigate(`/brand/${brand.brand_id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <BrandLogoIcon 
                    logoUrl={brand.logo_url} 
                    website={brand.website}
                    brandName={brand.brand_name}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{brand.brand_name}</h3>
                      {brand.event_count !== undefined && brand.verified_rate !== undefined && brand.independent_sources !== undefined && (() => {
                        const meta = confidenceMeta(brand.event_count, brand.verified_rate, brand.independent_sources);
                        if (meta.level === 'low' || meta.level === 'none') {
                          return (
                            <Badge variant="outline" className="gap-1 border-warning/50 text-warning text-[10px] px-1.5 py-0">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {meta.label}
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {brand.last_event_at && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Last event: {new Date(brand.last_event_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {FEATURES.companyScore && brand.overall_score != null ? (
                    <>
                      <div className={`text-2xl font-bold ${getScoreColor(brand.overall_score)}`}>
                        {brand.overall_score}
                      </div>
                      <div className="text-xs text-muted-foreground">/100</div>
                    </>
                  ) : FEATURES.communityOutlook ? (
                    <OutlookConfidenceBadge brandId={brand.brand_id} />
                  ) : (
                    <div className="text-sm text-muted-foreground">—</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}