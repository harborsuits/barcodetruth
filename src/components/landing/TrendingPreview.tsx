import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { confidenceMeta } from "@/lib/confidence";

interface TrendingBrand {
  brand_id: string;
  brand_name: string;
  logo_url?: string;
  overall_score: number;
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
      .select('brand_id, name, score, events_7d, events_30d, verified_rate, independent_sources, score_confidence, last_event_at, trend_score')
      .limit(5);

    if (trendingData && trendingData.length) {
      // Fetch logos for these brands
      const brandIds = trendingData.map(b => b.brand_id);
      let logoMap: Record<string, string> = {};
      if (brandIds.length > 0) {
        const { data: brandLogos } = await supabase
          .from('brands')
          .select('id, logo_url')
          .in('id', brandIds);

        logoMap = (brandLogos || []).reduce((acc, b) => {
          if (b.logo_url) acc[b.id] = b.logo_url;
          return acc;
        }, {} as Record<string, string>);
      }

      setTrending(trendingData.map((b: any) => ({
        brand_id: b.brand_id,
        brand_name: b.name,
        logo_url: logoMap[b.brand_id],
        event_count: b.events_30d || 0,
        overall_score: b.score || 50,
        confidence: b.score_confidence || 0.5,
        verified_rate: b.verified_rate || 0,
        independent_sources: b.independent_sources || 0,
        last_event_at: b.last_event_at
      })));
      setLoading(false);
      return;
    }

    // Fallback: show most recently updated brands by baseline scores
    const { data: recentScores } = await supabase
      .from('brand_scores')
      .select('brand_id, score_labor, score_environment, score_politics, score_social, last_updated')
      .order('last_updated', { ascending: false })
      .limit(5);

    const fallbackIds = (recentScores || []).map(b => b.brand_id);
    const { data: brandRows } = await supabase
      .from('brands')
      .select('id, name, logo_url')
      .in('id', fallbackIds);

    const logoMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    (brandRows || []).forEach((b) => {
      if (b.logo_url) logoMap[b.id] = b.logo_url;
      nameMap[b.id] = b.name;
    });

    if (recentScores && recentScores.length) {
      setTrending(recentScores.map((r: any) => ({
        brand_id: r.brand_id,
        brand_name: nameMap[r.brand_id] || 'Brand',
        logo_url: logoMap[r.brand_id],
        event_count: 0,
        overall_score: Math.round((r.score_labor + r.score_environment + r.score_politics + r.score_social) / 4),
        confidence: 0.5,
        verified_rate: 0,
        independent_sources: 0,
        last_event_at: null
      })));
    }
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
                  <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-muted/40 rounded-lg">
                    {brand.logo_url ? (
                      <img 
                        src={brand.logo_url} 
                        alt={`${brand.brand_name} logo`}
                        loading="lazy"
                        className="max-w-full max-h-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-lg font-bold">
                        {brand.brand_name?.[0]?.toUpperCase() ?? 'B'}
                      </span>
                    )}
                  </div>
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
                    {brand.event_count === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Score based on baseline estimates
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getScoreColor(brand.overall_score)}`}>
                    {brand.overall_score}
                  </div>
                  <div className="text-xs text-muted-foreground">/100</div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}