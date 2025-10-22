import { useNavigate } from "react-router-dom";
import { Heart, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
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
  score: number | null;
  events: BrandEvent[];
  isFollowing?: boolean;
  notificationsEnabled?: boolean;
}

export const Trending = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch trending brands from Edge API
  const { data: trendingBrands, isLoading } = useQuery({
    queryKey: ["trending-brands"],
    queryFn: async () => {
      const API = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/v1-brands";
      
      // Fetch trending from Edge API (already filters for verified events)
      const trendingRes = await fetch(`${API}/trending?limit=50`);
      if (!trendingRes.ok) throw new Error("Failed to fetch trending brands");
      const trending = await trendingRes.json();

      if (!trending || trending.length === 0) return [];

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

      // Get recent events for each trending brand
      const brandsWithEvents = await Promise.all(
        trending.slice(0, 20).map(async (brand: any) => {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

          const { data: events } = await supabase
            .from("brand_events")
            .select("*")
            .eq("brand_id", brand.brand_id)
            .gte("event_date", threeMonthsAgo.toISOString())
            .order("event_date", { ascending: false })
            .limit(3);

          const userFollow = userFollows.find(f => f.brand_id === brand.brand_id);

          return {
            id: brand.brand_id,
            name: brand.name,
            score: brand.score ?? null,
            hasScore: brand.score != null,
            events: (events || []).map(e => ({
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
      );

      // Filter for brands with actual events and sort by activity
      return brandsWithEvents
        .filter(b => b.events.length > 0 && b.hasScore)
        .sort((a, b) => b.events.length - a.events.length)
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

  const getScoreColor = (score: number | null) => {
    if (score == null) return "border-muted bg-muted/10 text-muted-foreground";
    if (score >= 70) return "bg-success/10 text-success border-success/20";
    if (score >= 40) return "bg-warning/10 text-warning border-warning/20";
    return "bg-danger/10 text-danger border-danger/20";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header showBack={true} showSettings={false} />

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
                  {brand.score != null ? (
                    <div className={`flex flex-col items-center justify-center rounded-full border-2 w-16 h-16 shrink-0 ${getScoreColor(brand.score)}`}>
                      <div className="text-2xl font-bold">{brand.score}</div>
                      <div className="text-[10px] font-medium opacity-80">Score</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-full border-2 w-16 h-16 shrink-0 border-muted bg-muted/10">
                      <div className="text-2xl font-bold text-muted-foreground">—</div>
                      <div className="text-[10px] font-medium opacity-80 text-muted-foreground">Score</div>
                    </div>
                  )}

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


