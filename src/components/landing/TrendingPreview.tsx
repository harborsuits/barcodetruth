import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrendingBrand {
  brand_id: string;
  brand_name: string;
  overall_score: number;
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

    // Fallback to live query
    const { data } = await supabase
      .from('brands')
      .select(`
        id,
        name,
        brand_scores(score_labor, score_environment, score_politics, score_social)
      `)
      .limit(5);

    if (data) {
      setTrending(data.map((b: any) => ({
        brand_id: b.id,
        brand_name: b.name,
        overall_score: b.brand_scores?.[0] 
          ? Math.round((
              b.brand_scores[0].score_labor +
              b.brand_scores[0].score_environment +
              b.brand_scores[0].score_politics +
              b.brand_scores[0].score_social
            ) / 4)
          : 50
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
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!trending.length) return null;

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
          {trending.map((brand) => (
            <div
              key={brand.brand_id}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 cursor-pointer transition-all duration-150 ease-[var(--ease)] hover:shadow-[var(--shadow-md)]"
              onClick={() => navigate(`/brand/${brand.brand_id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-base">{brand.brand_name}</h3>
                  {brand.recent_event && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {brand.recent_event.category}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {brand.recent_event.verification}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {brand.recent_event.title}
                      </p>
                    </div>
                  )}
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
