import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const AdminIngestion = () => {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [calculatingScores, setCalculatingScores] = useState(false);

  // Fetch queue status
  const { data: queueStats, refetch } = useQuery({
    queryKey: ["queue-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_queue")
        .select("status")
        .eq("status", "pending");
      
      if (error) throw error;
      
      const { data: brands } = await supabase
        .from("brands")
        .select("id")
        .eq("is_active", true);
      
      const { data: events } = await supabase
        .from("brand_events")
        .select("brand_id");
      
      const { data: scores } = await supabase
        .from("brand_scores")
        .select("brand_id");
      
      return {
        queued: data?.length || 0,
        totalBrands: brands?.length || 0,
        totalEvents: events?.length || 0,
        brandsWithScores: scores?.length || 0,
      };
    },
    refetchInterval: 5000,
  });

  const triggerBatchProcessor = async (mode: string, limit: number = 10) => {
    setProcessing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-process-brands?mode=${mode}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed: ${response.status}`);
      }

      const result = await response.json();
      
      toast({
        title: "Processing Complete",
        description: `Processed ${result.processed} brands. ${result.succeeded} succeeded, ${result.failed} failed.`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const calculateScores = async () => {
    setCalculatingScores(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recompute-brand-scores`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode: "all" }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed: ${response.status}`);
      }

      const result = await response.json();
      
      toast({
        title: "Scores Calculated",
        description: `Updated scores for ${result.updated || 0} brands.`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Score Calculation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCalculatingScores(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">News Ingestion Control</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queueStats?.totalBrands || 0}</div>
              <p className="text-xs text-muted-foreground">Active Brands</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queueStats?.queued || 0}</div>
              <p className="text-xs text-muted-foreground">In Queue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queueStats?.totalEvents || 0}</div>
              <p className="text-xs text-muted-foreground">Total Events</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queueStats?.brandsWithScores || 0}</div>
              <p className="text-xs text-muted-foreground">With Scores</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Process Queue</CardTitle>
            <CardDescription>
              Trigger news ingestion for brands in the queue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => triggerBatchProcessor("scheduled", 10)}
              disabled={processing}
              className="w-full"
            >
              <Play className="mr-2 h-4 w-4" />
              {processing ? "Processing..." : "Process Next 10 Brands"}
            </Button>
            <Button
              onClick={() => triggerBatchProcessor("all", 25)}
              disabled={processing}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {processing ? "Processing..." : "Process All Brands (25 max)"}
            </Button>
          </CardContent>
        </Card>

        {/* Score Calculation */}
        <Card>
          <CardHeader>
            <CardTitle>Calculate Scores</CardTitle>
            <CardDescription>
              Recalculate brand scores based on current events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={calculateScores}
              disabled={calculatingScores}
              className="w-full"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              {calculatingScores ? "Calculating..." : "Calculate All Scores"}
            </Button>
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle>System Info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">
              The batch processor fetches news from multiple sources (Guardian, Reuters, AP, etc.) 
              and creates events for brands. After events are created, run the score calculator 
              to compute trending scores.
            </p>
            <p className="text-muted-foreground">
              Queue refreshes every 5 seconds. Processing typically takes 2-5 seconds per brand.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
