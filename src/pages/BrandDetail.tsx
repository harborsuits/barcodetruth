import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, Heart, HeartOff, Clock, CheckCircle2, Filter, Bell, BellOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EventCard, type BrandEvent } from "@/components/EventCard";
import { formatMonthYear } from "@/lib/events";
import CategoryFilter from "@/components/CategoryFilter";
import { AttributionFooter } from "@/components/AttributionFooter";
import { ReportIssue } from "@/components/ReportIssue";
import { topImpacts } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Updated events data matching unified structure
const eventsData: Record<string, BrandEvent> = {
  event1: {
    event_id: "event1",
    brand_id: "nike",
    category: "labor",
    description: "Workers at manufacturing facilities reported wage and safety concerns.",
    date: "2024-11-20",
    severity: "moderate",
    verification: "corroborated",
    orientation: "negative",
    impact: { labor: -15, social: -5 },
    sources: [
      {
        name: "The Guardian",
        url: "https://theguardian.com/nike-factory-2024",
        date: "2024-11-20",
        quote: "Workers reported extended shifts without adequate breaks, raising concerns about workplace conditions."
      },
      {
        name: "Reuters",
        url: "https://reuters.com/nike-wages-2024",
        date: "2024-11-22",
        quote: "Independent audits confirmed discrepancies in wage calculations at multiple supplier facilities."
      }
    ],
    jurisdiction: "Southeast Asia",
  },
  event2: {
    event_id: "event2",
    brand_id: "nike",
    category: "politics",
    description: "FEC filings show $2.5M in political donations across parties.",
    date: "2025-01-15",
    severity: "minor",
    verification: "official",
    orientation: "negative",
    impact: { politics: -10 },
    sources: [
      {
        name: "Federal Election Commission",
        url: "https://fec.gov/nike-donations-2025",
        date: "2025-01-15",
        quote: "Nike PAC contributed $2.5M to federal candidates during the 2024 election cycle."
      }
    ],
    jurisdiction: "US",
  },
  event3: {
    event_id: "event3",
    brand_id: "nike",
    category: "environment",
    description: "Company pledged to achieve carbon neutrality by 2030 with third-party verification.",
    date: "2025-01-08",
    severity: "minor",
    verification: "official",
    orientation: "positive",
    impact: { environment: 12 },
    sources: [
      {
        name: "Bloomberg",
        url: "https://bloomberg.com/nike-carbon-2025",
        date: "2025-01-08",
        quote: "Nike announced a comprehensive plan to reduce emissions by 50% across its global supply chain within five years."
      }
    ],
    jurisdiction: "Global",
  }
};

// Mock data
const brandData: Record<string, any> = {
  nike: {
    name: "Nike",
    parent_company: "Nike, Inc.",
    overall_score: 72,
    last_updated: "2025-01-15",
    signals: {
      labor: { score: 65, risk_level: "medium", recent_events: ["event1"] },
      environment: { score: 78, risk_level: "low", recent_events: ["event3"] },
      politics: { score: 60, donations_total: 2500000, party_breakdown: { D: 60, R: 40, Other: 0 }, recent_events: ["event2"] },
      social: { score: 85, risk_level: "low", recent_events: [] },
    },
    trending: { velocity: "stable", sentiment_shift: -5 },
    community_insights: { percent_avoid: 23, trend_change: "+5%" },
    alternatives: [
      { 
        brand_id: "allbirds", 
        name: "Allbirds", 
        score: 89, 
        why: "Higher labor score (+15) and comprehensive environmental transparency", 
        price_context: "~15% more",
        sources: [
          { 
            name: "Bloomberg", 
            date: "2025-08-10",
            url: "https://bloomberg.com/allbirds-carbon-2025"
          }
        ]
      },
      { 
        brand_id: "veja", 
        name: "Veja", 
        score: 87, 
        why: "Transparent supply chain with fair trade certification", 
        price_context: "Similar price",
        sources: [
          { 
            name: "Fair Trade International", 
            date: "2025-06-15"
          }
        ]
      },
    ],
  },
  patagonia: {
    name: "Patagonia",
    parent_company: "Patagonia, Inc.",
    overall_score: 91,
    last_updated: "2025-01-20",
    signals: {
      labor: { score: 92, risk_level: "low", recent_events: [] },
      environment: { score: 95, risk_level: "low", recent_events: [] },
      politics: { score: 85, donations_total: 1000000, party_breakdown: { D: 80, R: 10, Other: 10 }, recent_events: [] },
      social: { score: 92, risk_level: "low", recent_events: [] },
    },
    trending: { velocity: "rising", sentiment_shift: 12 },
    community_insights: { percent_avoid: 3, trend_change: "-2%" },
    alternatives: [],
  },
};

export const BrandDetail = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "labor" | "environment" | "politics" | "cultural-values">("all");
  
  const brand = brandData[brandId || ""] || brandData.nike;

  // Query for notification follow status
  const { data: followData } = useQuery({
    queryKey: ['follow', brandId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data, error } = await supabase
        .from('user_follows')
        .select('notifications_enabled')
        .eq('brand_id', brandId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
  });

  // Query for notification usage today
  const { data: usage } = useQuery({
    queryKey: ['notif-usage', brandId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { sent_today: 0 };
      
      const { data } = await supabase
        .from('v_notification_usage_today')
        .select('sent_today')
        .eq('user_id', session.user.id)
        .eq('brand_id', brandId)
        .maybeSingle();
      
      return data ?? { sent_today: 0 };
    },
    enabled: !!brandId,
  });

  // Mutation to toggle notifications
  const toggleNotifications = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to enable notifications');
      }

      const enabled = !followData?.notifications_enabled;
      const { error } = await supabase
        .from('user_follows')
        .upsert(
          { 
            brand_id: brandId!, 
            notifications_enabled: enabled,
            user_id: session.user.id 
          } as any,
          { onConflict: 'user_id,brand_id' }
        );
      
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      toast({
        title: enabled ? 'Alerts enabled' : 'Alerts disabled',
        description: enabled
          ? 'We\'ll notify you on significant score changes.'
          : 'You can re-enable anytime.'
      });
      queryClient.invalidateQueries({ queryKey: ['follow', brandId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  const getRiskBadge = (risk: string) => {
    const variants: Record<string, string> = {
      low: "bg-success-light text-success",
      medium: "bg-warning-light text-warning",
      high: "bg-danger-light text-danger",
    };
    return variants[risk] || variants.low;
  };

  const getStalenessBadge = (lastUpdated: string) => {
    const daysSince = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
    return {
      className: daysSince > 30 ? "text-warning font-medium" : "text-muted-foreground",
      title: `${daysSince} day${daysSince !== 1 ? 's' : ''} since last update`,
      isStale: daysSince > 30,
    };
  };

  const daysSinceUpdate = (iso?: string) => {
    if (!iso) return undefined;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  };

  // Quiet hours helper functions
  const isQuietHoursUTC = () => {
    const h = new Date().getUTCHours();
    return h >= 22 || h < 7;
  };

  const nextQuietLiftUTC = () => {
    const now = new Date();
    const next = new Date(now);
    if (now.getUTCHours() >= 22) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    next.setUTCHours(7, 0, 0, 0);
    return next;
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-screen-md mx-auto px-4 sm:px-6 py-4">
          <div 
            className={`flex items-center gap-3 ${toggleNotifications.isPending ? 'opacity-70 pointer-events-none' : ''}`}
            aria-busy={toggleNotifications.isPending}
          >
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{brand.name}</h1>
              <p className="text-sm text-muted-foreground">{brand.parent_company}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleNotifications.mutate()}
                  disabled={toggleNotifications.isPending}
                >
                  {toggleNotifications.isPending ? (
                    'Saving...'
                  ) : followData?.notifications_enabled ? (
                    <>
                      <Bell className="h-4 w-4 mr-2" />
                      Following
                    </>
                  ) : (
                    <>
                      <BellOff className="h-4 w-4 mr-2" />
                      Notify me
                    </>
                  )}
                </Button>
                {followData?.notifications_enabled && (
                  <p className="text-xs text-muted-foreground">
                    Alerts today: {usage?.sent_today ?? 0}/2
                  </p>
                )}
                {isQuietHoursUTC() && (
                  <div className="text-xs text-muted-foreground">
                    Paused until {nextQuietLiftUTC().toUTCString().slice(17, 22)} UTC
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFollowing(!isFollowing)}
              >
                {isFollowing ? (
                  <Heart className="h-5 w-5 fill-current text-danger" />
                ) : (
                  <HeartOff className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-screen-md mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Overall Score */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <div className={`text-6xl font-bold ${getScoreColor(brand.overall_score)}`}>
                {brand.overall_score}
              </div>
              <p className="text-muted-foreground">Overall Score</p>
              <div className="flex items-center justify-center gap-2 text-sm">
                {brand.trending.velocity === "rising" && (
                  <>
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-success">Rising</span>
                  </>
                )}
                {brand.trending.velocity === "falling" && (
                  <>
                    <TrendingDown className="h-4 w-4 text-danger" />
                    <span className="text-danger">Falling</span>
                  </>
                )}
                {brand.trending.velocity === "stable" && (
                  <span className="text-muted-foreground">Stable</span>
                )}
              </div>
              
              {/* Why this matters */}
              {Object.keys(brand.signals).length > 0 && (
                <div className="pt-4 mt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>Why this matters:</strong> {
                      (() => {
                        const impacts = topImpacts(brand.signals);
                        if (impacts.length === 0) return "No significant recent activity.";
                        
                        const descriptions: string[] = [];
                        impacts.forEach(item => {
                          const signal = brand.signals[item.key];
                          if (item.key === 'labor') descriptions.push(`labor practices`);
                          if (item.key === 'environment') descriptions.push(`environmental impact`);
                          if (item.key === 'politics') descriptions.push(`political activity`);
                          if (item.key === 'social') descriptions.push(`community impact`);
                        });
                        
                        return `Recent activity in ${descriptions.join(' and ')}.`;
                      })()
                    }
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span 
                  className={getStalenessBadge(brand.last_updated).className}
                  title={getStalenessBadge(brand.last_updated).title}
                >
                  Last updated: {new Date(brand.last_updated).toLocaleDateString()}
                  {getStalenessBadge(brand.last_updated).isStale && " (stale)"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Scores */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Category Breakdown</CardTitle>
              <CategoryFilter value={categoryFilter} onChange={setCategoryFilter} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(brand.signals)
              .filter(([category]) => categoryFilter === "all" || category === categoryFilter)
              .map(([category, data]: [string, any]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{category}</span>
                    <Badge className={getRiskBadge(data.risk_level || "low")}>
                      {data.risk_level || "low"}
                    </Badge>
                  </div>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label={`Explain ${category} score`}>
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Explain
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle className="capitalize">{category} Score Breakdown</SheetTitle>
                        <SheetDescription>
                          Verified sources and recent events affecting this score
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-6 space-y-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Current Score</span>
                            <span className={`text-2xl font-bold ${getScoreColor(data.score)}`}>
                              {data.score}/100
                            </span>
                          </div>
                          <Progress value={data.score} className="h-2" />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Last updated: {new Date(brand.last_updated).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        {category === "politics" && (
                          <div className="space-y-3 p-4 bg-muted rounded-lg">
                            <h4 className="font-medium text-sm">Political Contributions</h4>
                            <p className="text-sm text-muted-foreground">
                              Total: ${(data.donations_total / 1000000).toFixed(1)}M
                            </p>
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span>Democratic</span>
                                  <span className="font-medium">{data.party_breakdown.D}%</span>
                                </div>
                                <Progress value={data.party_breakdown.D} className="h-2" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span>Republican</span>
                                  <span className="font-medium">{data.party_breakdown.R}%</span>
                                </div>
                                <Progress value={data.party_breakdown.R} className="h-2" />
                              </div>
                            </div>
                          </div>
                        )}

                        {data.recent_events && data.recent_events.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-medium">Recent Events</h4>
                            {data.recent_events.map((eventId: string) => {
                              const event = eventsData[eventId];
                              if (!event) return null;
                              
                              return (
                                <EventCard key={eventId} event={event} showFullDetails={true} />
                              );
                            })}
                          </div>
                        )}

                        {(!data.recent_events || data.recent_events.length === 0) && (
                          <div className="text-center py-8 space-y-2">
                            <CheckCircle2 className="h-12 w-12 mx-auto text-success opacity-50" />
                            <p className="text-sm text-muted-foreground">
                              No recent events or concerns in this category
                            </p>
                          </div>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                <Progress value={data.score} className="h-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{data.score}/100</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Community Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Community Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Users avoiding this brand</span>
              <span className="font-semibold">{brand.community_insights.percent_avoid}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Trend change</span>
              <span className={brand.community_insights.trend_change.startsWith("+") ? "text-warning" : "text-success"}>
                {brand.community_insights.trend_change}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Alternatives */}
        {brand.alternatives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Better Alternatives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {brand.alternatives.map((alt: any) => (
                <Card
                  key={alt.brand_id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => navigate(`/brand/${alt.brand_id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{alt.name}</h4>
                          <div className={`text-xl font-bold ${getScoreColor(alt.score)}`}>
                            {alt.score}
                          </div>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{alt.why}</p>
                        {alt.price_context && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Price:</span> {alt.price_context}
                          </p>
                        )}
                        {alt.sources?.[0] && (
                          <p className="text-xs italic text-muted-foreground/70 pt-1 border-t">
                            According to {alt.sources[0].name}
                            {alt.sources[0].date ? `, ${formatMonthYear(alt.sources[0].date)}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}
        
        {/* Attribution Footer */}
        <AttributionFooter />
        
        {/* Report Issue */}
        <div className="flex justify-center">
          <ReportIssue 
            subjectType="brand" 
            subjectId={brandId} 
            contextUrl={window.location.href}
          />
        </div>
      </main>
    </div>
  );
};


