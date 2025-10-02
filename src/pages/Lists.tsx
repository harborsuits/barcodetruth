import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const Lists = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("following");
  const { toast } = useToast();

  // Fetch user's followed brands
  const { data: followedBrands, isLoading } = useQuery({
    queryKey: ["user-follows"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return [];
      }

      // Get user follows
      const { data: follows, error } = await supabase
        .from("user_follows")
        .select("brand_id, notifications_enabled")
        .eq("user_id", user.id);

      if (error) {
        toast({
          title: "Error loading brands",
          description: error.message,
          variant: "destructive",
        });
        return [];
      }

      if (!follows || follows.length === 0) {
        return [];
      }

      // Get brand details
      const { data: brands } = await supabase
        .from("brands")
        .select("id, name")
        .in("id", follows.map(f => f.brand_id));

      // Get brand scores
      const { data: scores } = await supabase
        .from("brand_scores")
        .select("brand_id, score_labor, score_environment, score_politics, score_social")
        .in("brand_id", follows.map(f => f.brand_id));

      // Merge all data
      return follows.map(follow => {
        const brand = brands?.find(b => b.id === follow.brand_id);
        const brandScore = scores?.find(s => s.brand_id === follow.brand_id);
        const overallScore = brandScore 
          ? Math.round((brandScore.score_labor + brandScore.score_environment + 
                       brandScore.score_politics + brandScore.score_social) / 4)
          : 50;
        
        return {
          id: follow.brand_id,
          name: brand?.name || "Unknown Brand",
          score: overallScore,
          notifications: follow.notifications_enabled,
        };
      });
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">My Lists</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {followedBrands && followedBrands.length === 0 ? (
              <Card>
                <CardContent className="pt-8 pb-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    You haven't followed any brands yet
                  </p>
                  <Button onClick={() => navigate("/")}>
                    Discover Brands
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold mb-4">Following ({followedBrands?.length || 0})</h2>
                {followedBrands?.map((brand) => (
                  <Card
                    key={brand.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => navigate(`/brand/${brand.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium">{brand.name}</span>
                          {brand.notifications && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              🔔 Notifications on
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-bold ${getScoreColor(brand.score)}`}>
                            {brand.score}
                          </span>
                          <span className="text-sm text-muted-foreground">/100</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};


