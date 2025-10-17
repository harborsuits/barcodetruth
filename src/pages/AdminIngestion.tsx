import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Clock, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const AdminIngestion = () => {
  const navigate = useNavigate();

  // Fetch queue status
  const { data: queueStats } = useQuery({
    queryKey: ["queue-stats"],
    queryFn: async () => {
      const { data: queueData } = await supabase
        .from("processing_queue")
        .select("status, started_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(100);
      
      const { data: brands } = await supabase
        .from("brands")
        .select("id, name, last_news_ingestion, last_ingestion_status")
        .eq("is_active", true);
      
      const { data: events } = await supabase
        .from("brand_events")
        .select("brand_id, created_at")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      const { data: scores } = await supabase
        .from("brand_scores")
        .select("brand_id, last_updated")
        .order("last_updated", { ascending: false });
      
      const pending = queueData?.filter(q => q.status === 'pending').length || 0;
      const processing = queueData?.filter(q => q.status === 'processing').length || 0;
      const completed = queueData?.filter(q => q.status === 'completed').length || 0;
      const failed = queueData?.filter(q => q.status === 'failed').length || 0;
      
      return {
        pending,
        processing,
        completed,
        failed,
        totalBrands: brands?.length || 0,
        events24h: events?.length || 0,
        brandsWithScores: scores?.length || 0,
        recentBrands: brands?.slice(0, 5) || [],
      };
    },
    refetchInterval: 5000,
  });


  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-accent rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">System Health</h1>
              <p className="text-sm text-muted-foreground">Automated ingestion and scoring</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Queue Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <div className="text-2xl font-bold">{queueStats?.pending || 0}</div>
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <div className="text-2xl font-bold">{queueStats?.processing || 0}</div>
              </div>
              <p className="text-xs text-muted-foreground">Processing</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div className="text-2xl font-bold">{queueStats?.completed || 0}</div>
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <div className="text-2xl font-bold">{queueStats?.failed || 0}</div>
              </div>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queueStats?.totalBrands || 0}</div>
              <p className="text-xs text-muted-foreground">Active Brands</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queueStats?.events24h || 0}</div>
              <p className="text-xs text-muted-foreground">Events (24h)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queueStats?.brandsWithScores || 0}</div>
              <p className="text-xs text-muted-foreground">Brands Scored</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Brand Updates</CardTitle>
            <CardDescription>Last 5 brands processed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queueStats?.recentBrands?.map((brand: any) => (
                <div key={brand.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/50">
                  <div>
                    <p className="font-medium">{brand.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {brand.last_news_ingestion 
                        ? `Last update: ${new Date(brand.last_news_ingestion).toLocaleString()}`
                        : 'Never processed'}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    brand.last_ingestion_status === 'success' 
                      ? 'bg-green-500/20 text-green-600' 
                      : brand.last_ingestion_status === 'failed'
                      ? 'bg-red-500/20 text-red-600'
                      : 'bg-gray-500/20 text-gray-600'
                  }`}>
                    {brand.last_ingestion_status || 'pending'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Automation Info */}
        <Card>
          <CardHeader>
            <CardTitle>Automated Processing</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p>Queue processor runs every 5 minutes</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p>Fortune 500 brands checked hourly for breaking news</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p>Scores recomputed every 15 minutes</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p>New brands automatically enqueued on creation</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
