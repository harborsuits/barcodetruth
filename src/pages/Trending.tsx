import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EventCard, type BrandEvent } from "@/components/EventCard";
import { topImpacts } from "@/lib/events";
import { AttributionFooter } from "@/components/AttributionFooter";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendingBrandData {
  id: string;
  name: string;
  score: number;
  events: BrandEvent[];
  isFollowing?: boolean;
  notificationsEnabled?: boolean;
}

export const Trending = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch trending brands with their data
  const { data: trendingBrands, isLoading } = useQuery({
    queryKey: ["trending-brands"],
    queryFn: async () => {
      // Get brands with recent events (last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data: brands, error: brandsError } = await supabase
        .from("brands")
        .select("id, name")
        .limit(20);

      if (brandsError) throw brandsError;
      if (!brands || brands.length === 0) return [];

      const brandIds = brands.map(b => b.id);

      // Get scores
      const { data: scores } = await supabase
        .from("brand_scores")
        .select("brand_id, score_labor, score_environment, score_politics, score_social")
        .in("brand_id", brandIds);

      // Get recent events
      const { data: events } = await supabase
        .from("brand_events")
        .select("*")
        .in("brand_id", brandIds)
        .gte("event_date", threeMonthsAgo.toISOString())
        .order("event_date", { ascending: false });

      // Get user follows
      const { data: { user } } = await supabase.auth.getUser();
      let userFollows: any[] = [];
      if (user) {
        const { data } = await supabase
          .from("user_follows")
          .select("brand_id, notifications_enabled")
          .eq("user_id", user.id);
        userFollows = data || [];
      }

      // Combine data and filter for brands with meaningful activity
      return brands
        .map(brand => {
          const brandScore = scores?.find(s => s.brand_id === brand.id);
          const overallScore = brandScore 
            ? Math.round((brandScore.score_labor + brandScore.score_environment + 
                         brandScore.score_politics + brandScore.score_social) / 4)
            : 50;

          const brandEvents = events?.filter(e => e.brand_id === brand.id).slice(0, 3) || [];
          const userFollow = userFollows.find(f => f.brand_id === brand.id);

          return {
            id: brand.id,
            name: brand.name,
            score: overallScore,
            hasScore: !!brandScore,
            events: brandEvents.map(e => ({
              event_id: e.event_id,
              brand_id: e.brand_id,
              category: e.category,
              description: e.description,
              date: e.event_date || e.created_at,
              severity: e.severity,
              verification: e.verification,
              orientation: e.orientation,
              impact: {
                labor: e.impact_labor || 0,
                environment: e.impact_environment || 0,
                politics: e.impact_politics || 0,
                social: e.impact_social || 0,
              },
              sources: [],
              jurisdiction: e.jurisdiction,
            })) as BrandEvent[],
            isFollowing: !!userFollow,
            notificationsEnabled: userFollow?.notifications_enabled || false,
          };
        })
        .filter(b => {
          // Only show brands with recent activity AND a score (not just default)
          return b.events.length > 0 && b.hasScore;
        })
        .sort((a, b) => b.events.length - a.events.length) // Sort by activity
        .slice(0, 10);
    },
  });

  // Toggle follow
  const followMutation = useMutation({
    mutationFn: async ({ brandId, isFollowing }: { brandId: string; isFollowing: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to follow brands");

      if (isFollowing) {
        await supabase
          .from("user_follows")
          .delete()
          .eq("user_id", user.id)
          .eq("brand_id", brandId);
      } else {
        await supabase
          .from("user_follows")
          .insert({ user_id: user.id, brand_id: brandId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trending-brands"] });
    },
  });

  // Toggle notifications
  const notifyMutation = useMutation({
    mutationFn: async ({ brandId, enabled }: { brandId: string; enabled: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to enable notifications");

      await supabase
        .from("user_follows")
        .update({ notifications_enabled: !enabled })
        .eq("user_id", user.id)
        .eq("brand_id", brandId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trending-brands"] });
    },
  });

  const handleFollow = (brand: TrendingBrandData, e: React.MouseEvent) => {
    e.stopPropagation();
    followMutation.mutate(
      { brandId: brand.id, isFollowing: !!brand.isFollowing },
      {
        onSuccess: () => {
          toast({
            title: brand.isFollowing ? "Unfollowed" : "Following",
            description: brand.isFollowing ? `Stopped following ${brand.name}` : `You're now following ${brand.name}`,
          });
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleNotify = (brand: TrendingBrandData, e: React.MouseEvent) => {
    e.stopPropagation();
    notifyMutation.mutate(
      { brandId: brand.id, enabled: !!brand.notificationsEnabled },
      {
        onSuccess: () => {
          toast({
            title: brand.notificationsEnabled ? "Notifications Off" : "Notifications On",
            description: brand.notificationsEnabled ? `Stopped notifications for ${brand.name}` : `You'll be notified of changes to ${brand.name}`,
          });
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-success/10 text-success border-success/20";
    if (score >= 40) return "bg-warning/10 text-warning border-warning/20";
    return "bg-danger/10 text-danger border-danger/20";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Trending Brands</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !trendingBrands || trendingBrands.length === 0 ? (
          <Card>
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-muted-foreground mb-4">
                No trending brands with recent activity
              </p>
              <Button onClick={() => navigate("/")}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {trendingBrands.map((brand) => (
            <Card
              key={brand.id}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => navigate(`/brand/${brand.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Score Badge */}
                  <div className={`flex flex-col items-center justify-center rounded-full border-2 w-16 h-16 shrink-0 ${getScoreColor(brand.score)}`}>
                    <div className="text-2xl font-bold">{brand.score}</div>
                    <div className="text-[10px] font-medium opacity-80">Score</div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg">{brand.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {brand.events.length} recent {brand.events.length === 1 ? 'event' : 'events'}
                      </span>
                    </div>

                    {/* Events */}
                    <div className="space-y-2.5">
                      {brand.events.slice(0, 2).map((event, idx) => (
                        <EventCard key={idx} event={event} compact />
                      ))}
                      
                      {brand.events.length > 2 && (
                        <Button 
                          variant="link" 
                          className="h-auto p-0 text-xs group"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/brand/${brand.id}`);
                          }}
                          aria-label={`View full timeline of ${brand.events.length} events for ${brand.name}`}
                        >
                          View Full Timeline ({brand.events.length} events)
                          <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">→</span>
                        </Button>
                      )}
                    </div>

                    {/* Why it matters */}
                    {(() => {
                      const impacts = topImpacts(brand.events[0]?.impact, 2)
                        .map(({ key, val }) => `${val > 0 ? '+' : ''}${val} ${key.charAt(0).toUpperCase() + key.slice(1)}`)
                        .join(' • ');
                      return impacts ? (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Why it matters:</span> {impacts}
                          </p>
                        </div>
                      ) : null;
                    })()}

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant={brand.isFollowing ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs rounded-full transition-all"
                        onClick={(e) => handleFollow(brand, e)}
                        aria-label={`${brand.isFollowing ? "Unfollow" : "Follow"} ${brand.name}`}
                      >
                        <Heart className={`h-3 w-3 ${brand.isFollowing ? "fill-current" : ""}`} />
                        {brand.isFollowing ? "Following" : "Follow"}
                      </Button>
                      {brand.isFollowing && (
                        <Button
                          variant={brand.notificationsEnabled ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs rounded-full transition-all"
                          onClick={(e) => handleNotify(brand, e)}
                          aria-label={`${brand.notificationsEnabled ? "Turn off notifications" : "Turn on notifications"} for ${brand.name}`}
                        >
                          <Bell className={`h-3 w-3 ${brand.notificationsEnabled ? "fill-current" : ""}`} />
                          {brand.notificationsEnabled ? "Notifying" : "Notify"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
              ))}
          </div>
        )}
        
        {/* Attribution Footer */}
        <AttributionFooter />
      </main>
    </div>
  );
};


