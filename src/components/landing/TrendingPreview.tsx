import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <section className="py-8 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!trending.length) return null;

  return (
    <section className="py-8 px-4 bg-muted/30">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Trending Now</h2>
          </div>
          <Button variant="ghost" onClick={() => navigate('/trending')}>
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trending.map((brand) => (
            <Card
              key={brand.brand_id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/brand/${brand.brand_id}`)}
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg">{brand.brand_name}</h3>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getScoreColor(brand.overall_score)}`}>
                        {brand.overall_score}
                      </div>
                      <div className="text-xs text-muted-foreground">/100</div>
                    </div>
                  </div>
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
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
