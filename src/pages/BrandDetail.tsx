import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, Heart, HeartOff, Clock, CheckCircle2, Filter, Bell, BellOff, Home, Info, ExternalLink } from "lucide-react";
import { ScoreExplainDrawer } from "@/components/brand/ScoreExplainDrawer";
import { ConfidenceChip } from "@/components/brand/ConfidenceChip";
import { LastUpdatedBadge } from "@/components/brand/LastUpdatedBadge";
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
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import { EventTimeline } from "@/components/EventTimeline";
import { TrustIndicators } from "@/components/TrustIndicators";
import { InsufficientDataBadge } from "@/components/InsufficientDataBadge";
import { useBrandEnrichment } from "@/hooks/useBrandEnrichment";

export const BrandDetail = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { fetchSummary, fetchLogo } = useBrandEnrichment();
  const [isFollowing, setIsFollowing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "labor" | "environment" | "politics" | "cultural-values">("all");
  const [showParent, setShowParent] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  
  // Fetch brand data
  const { data: brand, isLoading: brandLoading } = useQuery({
    queryKey: ['brand', brandId],
    queryFn: async () => {
      if (!brandId) throw new Error("Brand ID required");
      
      // Get brand info including logo and description
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('id, name, parent_company, updated_at, logo_url, logo_attribution, description, description_source, website, wikidata_qid')
        .eq('id', brandId)
        .single();
      
      if (brandError) throw brandError;
      
      // Get scores including breakdown
      const { data: scores } = await supabase
        .from('brand_scores')
        .select('score_labor, score_environment, score_politics, score_social, last_updated, breakdown')
        .eq('brand_id', brandId)
        .maybeSingle();
      
      // Get coverage/confidence data
      const { data: coverage } = await supabase
        .from('brand_data_coverage')
        .select('events_30d, events_365d, verified_rate, independent_sources, last_event_at')
        .eq('brand_id', brandId)
        .maybeSingle();
      
      // Get recent events (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const { data: events } = await supabase
        .from('brand_events')
        .select('*')
        .eq('brand_id', brandId)
        .gte('event_date', twelveMonthsAgo.toISOString())
        .order('event_date', { ascending: false });
      
      // Fetch sources for these events
      const eventIds = (events || []).map((e: any) => e.event_id);
      let sourcesByEvent: Record<string, any[]> = {};
      if (eventIds.length) {
        const { data: srcs } = await supabase
          .from('event_sources')
          .select('event_id, source_name, source_url, canonical_url, archive_url, source_date, quote')
          .in('event_id', eventIds);
        if (srcs) {
          sourcesByEvent = srcs.reduce((acc: Record<string, any[]>, s: any) => {
            const list = acc[s.event_id] || [];
            list.push({ 
              name: s.source_name, 
              url: s.source_url || undefined, 
              canonical_url: s.canonical_url || undefined,
              archive_url: s.archive_url || undefined,
              date: s.source_date || undefined, 
              quote: s.quote || undefined 
            });
            acc[s.event_id] = list;
            return acc;
          }, {});
        }
      }
      
      const normalizedEvents = (events || []).map((e: any) => ({
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
        sources: sourcesByEvent[e.event_id] || [],
        jurisdiction: e.jurisdiction,
        raw_data: e.raw_data,
      }));
      
      const overallScore = scores 
        ? Math.round((scores.score_labor + scores.score_environment + scores.score_politics + scores.score_social) / 4)
        : 50;
      
      return {
        id: brandData.id,
        name: brandData.name,
        parent_company: brandData.parent_company || brandData.name,
        logo_url: brandData.logo_url,
        logo_attribution: brandData.logo_attribution,
        description: brandData.description,
        description_source: brandData.description_source,
        website: brandData.website,
        wikidata_qid: brandData.wikidata_qid,
        overall_score: overallScore,
        last_updated: scores?.last_updated || brandData.updated_at,
        breakdown: scores?.breakdown,
        coverage: {
          events_90d: coverage?.events_30d || 0,
          events_365d: coverage?.events_365d || 0,
          verified_rate: coverage?.verified_rate || 0,
          independent_sources: coverage?.independent_sources || 0,
          last_event_at: coverage?.last_event_at || null,
        },
        signals: {
          labor: { score: scores?.score_labor || 50, risk_level: "low", recent_events: [] },
          environment: { score: scores?.score_environment || 50, risk_level: "low", recent_events: [] },
          politics: { score: scores?.score_politics || 50, risk_level: "low", recent_events: [] },
          social: { score: scores?.score_social || 50, risk_level: "low", recent_events: [] },
        },
        events: normalizedEvents,
        trending: { velocity: "stable", sentiment_shift: 0 },
        community_insights: { percent_avoid: 0, trend_change: "0%" },
        alternatives: [],
      };
    },
    enabled: !!brandId,
  });

  // Auto-enrich brands with wikidata_qid but missing logo
  useEffect(() => {
    console.log('[BrandDetail] Enrichment check:', { 
      hasBrand: !!brand, 
      hasQid: !!brand?.wikidata_qid,
      hasLogo: !!brand?.logo_url,
      logoAttr: brand?.logo_attribution,
    });
    
    if (brand && brand.wikidata_qid) {
      if (!brand.logo_url && brand.logo_attribution !== 'manual') {
        console.log('[BrandDetail] Triggering logo fetch for:', brand.id);
        fetchLogo(brand.id).then(success => {
          console.log('[BrandDetail] Logo fetch result:', success);
          if (success) queryClient.invalidateQueries({ queryKey: ['brand', brandId] });
        });
      }
    }
  }, [brand?.id, brand?.wikidata_qid]);


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

  // Fetch proof/breakdown data for transparency
  const { data: proofData } = useQuery({
    queryKey: ['brand-proof', brandId],
    queryFn: async () => {
      if (!brandId) return null;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-brand-proof?brandId=${brandId}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!brandId,
    staleTime: 60000,
  });

  // Fetch recent events for timeline
  const { data: recentEvents } = useQuery({
    queryKey: ['brand-events', brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const { data: events } = await supabase
        .from('brand_events')
        .select('event_id, category, event_date, verification, impact_labor, impact_environment, impact_politics, impact_social, event_sources(source_name, source_date)')
        .eq('brand_id', brandId)
        .order('event_date', { ascending: false })
        .limit(30);
      
      if (!events) return [];
      
      return events.map((r: any) => {
        const eff =
          r.category === 'labor' ? r.impact_labor :
          r.category === 'environment' ? r.impact_environment :
          r.category === 'politics' ? r.impact_politics :
          r.impact_social;
        
        const src = Array.isArray(r.event_sources) && r.event_sources[0]?.source_name;
        
        return {
          date: r.event_date,
          category: r.category,
          effective_delta: typeof eff === 'number' ? Math.round(eff) : undefined,
          title: src || undefined,
          source_name: src || 'Source',
          verification: r.verification || 'unverified',
        };
      });
    },
    enabled: !!brandId,
    staleTime: 60000,
  });

  // Fetch parent rollup data
  const { data: parentRollup } = useQuery({
    queryKey: ['parent-rollup', brandId],
    queryFn: async () => {
      if (!brandId) return null;
      const { data, error } = await supabase.functions.invoke('get-parent-rollup', {
        body: { brandId }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!brandId && showParent,
    staleTime: 600000, // 10 minutes
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
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-screen-md mx-auto px-4 sm:px-6 py-3">
          <div className="space-y-2">
            <Breadcrumbs brandName={brand?.name} />
            <div 
              className={`flex items-center gap-3 ${toggleNotifications.isPending ? 'opacity-70 pointer-events-none' : ''}`}
              aria-busy={toggleNotifications.isPending}
            >
            {brandLoading || !brand ? (
              <div className="flex-1">
                <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-24 bg-muted animate-pulse rounded mt-1" />
              </div>
            ) : (
              <>
                <div className="flex-1 flex items-center gap-3">
                  <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg border bg-muted/40">
                    {brand.logo_url ? (
                      <img 
                        src={brand.logo_url} 
                        alt={`${brand.name} logo`}
                        className="max-w-full max-h-full object-contain p-1.5"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-lg font-bold">
                        {brand.name?.[0]?.toUpperCase() ?? 'B'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-bold">{brand.name}</h1>
                      {showParent && parentRollup?.parent?.child_count > 1 && (
                        <Badge variant="outline" className="text-xs">
                          +{parentRollup.parent.child_count - 1} brands
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{brand.parent_company}</p>
                      {brand.parent_company !== brand.name && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => setShowParent(!showParent)}
                        >
                          {showParent ? 'Hide parent' : 'Include parent'}
                        </Button>
                      )}
                    </div>
                  </div>
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
              </>
            )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Mobile floating home button */}
      <Link 
        to="/" 
        className="fixed bottom-20 left-4 z-20 rounded-full border bg-card/90 backdrop-blur px-3 py-2 shadow-lg hover:shadow-xl transition-all text-sm font-medium flex items-center gap-1.5 md:hidden"
      >
        <Home className="h-4 w-4" />
        Home
      </Link>

      <main className="container max-w-screen-md mx-auto px-4 sm:px-6 py-6 space-y-6">
        {brandLoading ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p>Loading brand details...</p>
            </CardContent>
          </Card>
        ) : !brand ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p>Brand not found</p>
              <Button onClick={() => navigate('/')} className="mt-4">
                Go Home
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>

        {/* Overall Score */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center justify-center gap-3">
                  <div className={`text-6xl font-bold ${brand.coverage?.last_event_at ? getScoreColor(brand.overall_score) : "text-muted-foreground"}`}>
                    {brand.coverage?.last_event_at ? brand.overall_score : "—"}
                  </div>
                  {brand.coverage && (
                    <InsufficientDataBadge 
                      eventCount={brand.coverage.events_365d}
                      verifiedRate={brand.coverage.verified_rate}
                      independentSources={brand.coverage.independent_sources}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {brand.coverage && (
                    <ConfidenceChip coverage={brand.coverage} />
                  )}
                </div>
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
              
              {/* Trust Indicators */}
              {proofData?.breakdown && (
                <div className="pt-4 border-t">
                  <TrustIndicators
                    confidence={proofData.totals.confidence}
                    verifiedCount={proofData.breakdown.reduce((sum: number, b: any) => sum + b.verified_count, 0)}
                    totalCount={proofData.breakdown.reduce((sum: number, b: any) => sum + b.evidence_count, 0)}
                    independentSources={Math.max(...proofData.breakdown.map((b: any) => b.independent_owners))}
                    lastUpdated={brand.last_updated}
                    proofRequired={proofData.breakdown.some((b: any) => b.proof_required)}
                  />
                </div>
              )}
              
              {/* Why this matters */}
              {brand && brand.events && brand.events.length > 0 && (
                <div className="pt-4 mt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>Why this matters:</strong> Recent events show activity in{' '}
                    {brand.events.slice(0, 2).map((e: any) => e.category).join(', ')}.
                  </p>
                </div>
              )}
              
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <LastUpdatedBadge timestamp={brand.last_updated} />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setWhyOpen(true)}
                >
                  <Info className="w-4 h-4 mr-1" />
                  Why this score?
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Breakdown with transparency */}
        {proofData?.breakdown && (
          <>
            {showParent && parentRollup?.parent && (
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>Parent Company: {parentRollup.parent.name}</span>
                      <span 
                        className="text-sm text-muted-foreground cursor-help" 
                        title="Mean across subsidiaries in the last baseline window. This will evolve to event-weighted & revenue-weighted aggregation."
                      >
                        ℹ️
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {parentRollup.parent.child_count} {parentRollup.parent.child_count === 1 ? 'brand' : 'brands'}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Aggregated scores across: {parentRollup.parent.child_brands.join(', ')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['labor', 'environment', 'politics', 'social'] as const).map((cat) => {
                    const score = parentRollup.parent.scores[cat];
                    const confidence = parentRollup.parent.confidences[cat];
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize font-medium">{cat}</span>
                          <span className={getScoreColor(score)}>{score}</span>
                        </div>
                        <Progress value={score} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          Confidence: {confidence}% · Mean across subsidiaries
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            <ScoreBreakdown 
              brandId={brandId!} 
              blocks={proofData.breakdown} 
            />
          </>
        )}

        {/* Recent events timeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Events</CardTitle>
              <Link
                to={`/brands/${brandId}/proof`}
                className="text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground"
                aria-label="View all evidence for this brand"
              >
                View all evidence →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentEvents && recentEvents.length > 0 ? (
              <div className="max-h-96 overflow-auto" role="list" aria-label="Recent events timeline">
                <EventTimeline items={recentEvents} />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-3">No recent events</p>
                <Link
                  to={`/brands/${brandId}/proof`}
                  className="text-sm underline underline-offset-2 hover:text-foreground"
                >
                  View all evidence anyway →
                </Link>
              </div>
            )}
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
                      
                      {/* Source links */}
                      {brand && brand.events && brand.events.filter((e: any) => e.category === category && e.event_sources?.length > 0).length > 0 && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg border space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Source Documents
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {brand.events
                              .filter((e: any) => e.category === category)
                              .flatMap((event: any) => 
                                (event.event_sources || []).map((source: any) => ({
                                  name: source.source_name,
                                  url: source.canonical_url || source.archive_url || source.source_url,
                                  verification: event.verification,
                                  date: source.source_date,
                                }))
                              )
                              .filter((source: any, index: number, self: any[]) => 
                                index === self.findIndex((s: any) => s.url === source.url)
                              )
                              .slice(0, 8)
                              .map((source: any, idx: number) => (
                                source.url && (
                                  <a
                                    key={idx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-background border hover:border-primary transition-colors"
                                    title={`${source.name}${source.date ? ` - ${new Date(source.date).toLocaleDateString()}` : ''}`}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    <span className="max-w-[120px] truncate">{source.name}</span>
                                    {source.verification === 'official' && (
                                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] bg-green-600 text-white font-medium">
                                        Official
                                      </span>
                                    )}
                                  </a>
                                )
                              ))}
                          </div>
                        </div>
                      )}
                      
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
                        
                        {category === "politics" && data?.donations_total != null && data?.party_breakdown ? (
                          <div className="space-y-3 p-4 bg-muted rounded-lg">
                            <h4 className="font-medium text-sm">Political Contributions</h4>
                            <p className="text-sm text-muted-foreground">
                              Total: ${((data.donations_total as number) / 1000000).toFixed(1)}M
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
                        ) : null}

                        {brand && brand.events && brand.events.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="font-medium">Recent Events</h4>
                            {brand.events
                              .filter((e: any) => e.category === category)
                              .slice(0, 5)
                              .map((event: any) => {
                                // Map event_sources to EventCard sources format
                                const sources = (event.event_sources || []).map((es: any) => ({
                                  name: es.source_name,
                                  url: es.source_url,
                                  canonical_url: es.canonical_url,
                                  archive_url: es.archive_url,
                                  date: es.source_date,
                                  quote: es.quote,
                                }));
                                
                                return (
                                  <EventCard 
                                    key={event.event_id} 
                                    event={{
                                      event_id: event.event_id,
                                      brand_id: event.brand_id,
                                      category: event.category,
                                      title: event.title,
                                      description: event.description,
                                      date: event.event_date || event.created_at,
                                      occurred_at: event.occurred_at,
                                      severity: event.severity,
                                      verification: event.verification,
                                      orientation: event.orientation,
                                      impact: {
                                        labor: event.impact_labor || 0,
                                        environment: event.impact_environment || 0,
                                        politics: event.impact_politics || 0,
                                        social: event.impact_social || 0,
                                      },
                                      sources,
                                      jurisdiction: event.jurisdiction,
                                      raw_data: event.raw_data,
                                    }} 
                                    showFullDetails={true} 
                                  />
                                );
                              })}
                          </div>
                        ) : (
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
          </>
        )}
      </main>
      
      <ScoreExplainDrawer
        open={whyOpen}
        onOpenChange={setWhyOpen}
        breakdown={brand?.breakdown as any}
      />
    </div>
  );
};


