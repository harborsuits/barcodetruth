import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const Lists = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("following");
  const { toast } = useToast();

  // Fetch user's followed brands from Edge API
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

      // Fetch each brand from Edge API
      const API = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/v1-brands";
      const brandDetails = await Promise.all(
        follows.map(async (follow) => {
          try {
            const res = await fetch(`${API}/brands/${follow.brand_id}`);
            if (!res.ok) {
              return {
                id: follow.brand_id,
                name: "Unknown Brand",
                score: null,
                notifications: follow.notifications_enabled,
                last_event_at: null,
              };
            }
            const data = await res.json();
            return {
              id: follow.brand_id,
              name: data.name || "Unknown Brand",
              score: data.score,
              notifications: follow.notifications_enabled,
              last_event_at: data.last_event_at,
            };
          } catch {
            return {
              id: follow.brand_id,
              name: "Unknown Brand",
              score: null,
              notifications: follow.notifications_enabled,
              last_event_at: null,
            };
          }
        })
      );

      return brandDetails;
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header showBack={true} showSettings={false} />

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
                          {brand.last_event_at && brand.score != null ? (
                            <>
                              <span className={`text-2xl font-bold ${getScoreColor(brand.score)}`}>
                                {brand.score}
                              </span>
                              <span className="text-sm text-muted-foreground">/100</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
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


