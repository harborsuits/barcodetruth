import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, ExternalLink, Heart, HeartOff } from "lucide-react";
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

// Mock data
const brandData: Record<string, any> = {
  nike: {
    name: "Nike",
    parent_company: "Nike, Inc.",
    overall_score: 72,
    last_updated: "2025-01-15",
    signals: {
      labor: { score: 65, risk_level: "medium", recent_events: ["event1"] },
      environment: { score: 78, risk_level: "low", recent_events: [] },
      politics: { score: 60, donations_total: 2500000, party_breakdown: { D: 60, R: 40, Other: 0 } },
      social: { score: 85, risk_level: "low", recent_events: [] },
    },
    trending: { velocity: "stable", sentiment_shift: -5 },
    community_insights: { percent_avoid: 23, trend_change: "+5%" },
    alternatives: [
      { brand_id: "allbirds", name: "Allbirds", score: 89, why: "Strong environmental focus", price_context: "~15% more" },
      { brand_id: "veja", name: "Veja", score: 87, why: "Transparent supply chain", price_context: "Similar price" },
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
      politics: { score: 85, donations_total: 1000000, party_breakdown: { D: 80, R: 10, Other: 10 } },
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
                    <SheetContent side="bottom" className="h-[80vh]">
                      <SheetHeader>
                        <SheetTitle className="capitalize">{category} Score</SheetTitle>
                        <SheetDescription>
                          Sources and details for this score
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-6 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Score</span>
                            <span className={`text-2xl font-bold ${getScoreColor(data.score)}`}>
                              {data.score}/100
                            </span>
                          </div>
                          <Progress value={data.score} className="h-2" />
                        </div>
                        
                        {category === "politics" && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Political Donations</h4>
                            <p className="text-sm text-muted-foreground">
                              Total: ${(data.donations_total / 1000000).toFixed(1)}M
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span>Democratic: {data.party_breakdown.D}%</span>
                                <Progress value={data.party_breakdown.D} className="h-2 w-32" />
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span>Republican: {data.party_breakdown.R}%</span>
                                <Progress value={data.party_breakdown.R} className="h-2 w-32" />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <h4 className="font-medium text-sm">Sources</h4>
                          <div className="space-y-2">
                            <Card>
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium">FEC Filing</p>
                                    <p className="text-xs text-muted-foreground">Jan 15, 2025</p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
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
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold">{alt.name}</h4>
                        <p className="text-sm text-muted-foreground">{alt.why}</p>
                        <p className="text-xs text-muted-foreground">{alt.price_context}</p>
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(alt.score)}`}>
                        {alt.score}
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
