import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface OpsHealth {
  total_24h: number;
  below_gate: number;
  null_category: number;
  bad_verification: number;
  category_breakdown: Array<{ category_code: string; n: number }>;
  verification_breakdown: Array<{ verification: string; n: number }>;
}

export default function AdminOpsHealth() {
  const navigate = useNavigate();
  const [recomputeLoading, setRecomputeLoading] = useState(false);

  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['ops-health-24h'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ops_health_24h')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as OpsHealth;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusIcon = (value: number, threshold: number) => {
    if (value === 0) return <CheckCircle className="h-5 w-5 text-success" />;
    if (value <= threshold) return <AlertTriangle className="h-5 w-5 text-warning" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const { toast } = useToast();

  const triggerScoreRecompute = async () => {
    setRecomputeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('simple-brand-scorer', {
        body: {}
      });
      
      if (error) throw error;
      
      toast({
        title: "Score Recompute Started",
        description: `Processing scores for all brands. Results: ${JSON.stringify(data)}`
      });
      
      // Refetch health data after a few seconds
      setTimeout(() => refetch(), 3000);
    } catch (error) {
      console.error('Recompute error:', error);
      toast({
        variant: "destructive",
        title: "Recompute Failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setRecomputeLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div>
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Ops Health Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Refresh
            </Button>
            <Button 
              onClick={triggerScoreRecompute} 
              variant="default" 
              size="sm"
              disabled={recomputeLoading}
            >
              {recomputeLoading ? "Recomputing..." : "Recompute Scores"}
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">
          Real-time operational metrics from the last 24 hours
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : health ? (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Total Events
                  <CheckCircle className="h-5 w-5 text-success" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{health.total_24h}</div>
                <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
              </CardContent>
            </Card>

            <Card className={health.below_gate > 0 ? "border-destructive" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Below Gate
                  {getStatusIcon(health.below_gate, 5)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${health.below_gate > 0 ? 'text-destructive' : 'text-success'}`}>
                  {health.below_gate}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {health.below_gate === 0 ? '✅ All events passed gate' : '⚠️ Events with score < 11'}
                </p>
              </CardContent>
            </Card>

            <Card className={health.null_category > 0 ? "border-warning" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Missing Category
                  {getStatusIcon(health.null_category, 10)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${health.null_category > 0 ? 'text-warning' : 'text-success'}`}>
                  {health.null_category}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {health.null_category === 0 ? '✅ All categorized' : 'Need categorization'}
                </p>
              </CardContent>
            </Card>

            <Card className={health.bad_verification > 0 ? "border-warning" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Bad Verification
                  {getStatusIcon(health.bad_verification, 5)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${health.bad_verification > 0 ? 'text-warning' : 'text-success'}`}>
                  {health.bad_verification}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {health.bad_verification === 0 ? '✅ All valid' : 'Invalid verification values'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdowns */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {health.category_breakdown?.slice(0, 10).map((cat) => (
                    <div key={cat.category_code} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {cat.category_code}
                        </Badge>
                      </div>
                      <span className="font-semibold tabular-nums">{cat.n}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verification Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {health.verification_breakdown?.map((ver) => (
                    <div key={ver.verification} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            ver.verification === 'official' ? 'destructive' : 
                            ver.verification === 'corroborated' ? 'default' : 
                            'outline'
                          }
                          className="capitalize"
                        >
                          {ver.verification}
                        </Badge>
                      </div>
                      <span className="font-semibold tabular-nums">{ver.n}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Health Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {health.below_gate === 0 ? (
                    <CheckCircle className="h-6 w-6 text-success" />
                  ) : (
                    <XCircle className="h-6 w-6 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">Relevance Gate</p>
                    <p className="text-sm text-muted-foreground">
                      {health.below_gate === 0 
                        ? 'All events passed the 11/20 relevance threshold' 
                        : `${health.below_gate} events below gate need review`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {health.null_category === 0 ? (
                    <CheckCircle className="h-6 w-6 text-success" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-warning" />
                  )}
                  <div>
                    <p className="font-medium">Categorization</p>
                    <p className="text-sm text-muted-foreground">
                      {health.null_category === 0 
                        ? 'All events properly categorized' 
                        : `${health.null_category} events need category assignment`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {health.bad_verification === 0 ? (
                    <CheckCircle className="h-6 w-6 text-success" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-warning" />
                  )}
                  <div>
                    <p className="font-medium">Verification Status</p>
                    <p className="text-sm text-muted-foreground">
                      {health.bad_verification === 0 
                        ? 'All events have valid verification levels' 
                        : `${health.bad_verification} events with invalid verification`}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No health data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
