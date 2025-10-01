import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, Heart, HeartOff, Clock, CheckCircle2 } from "lucide-react";
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

const BrandDetail = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(false);
  
  const brand = brandData[brandId || ""] || brandData.nike;

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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{brand.name}</h1>
              <p className="text-sm text-muted-foreground">{brand.parent_company}</p>
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
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
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
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(brand.last_updated).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Category Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(brand.signals).map(([category, data]: [string, any]) => (
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
                      <Button variant="ghost" size="sm">
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
      </main>
    </div>
  );
};

export default BrandDetail;
