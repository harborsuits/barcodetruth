import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Leaf, MapPin, Vote, Loader2, ArrowRight, Building2, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface AlternativesSectionProps {
  brandId: string;
  brandName: string;
}

interface Alternative {
  brand_id: string;
  brand_name: string;
  parent_company: string | null;
  logo_url: string | null;
  reason: string;
  score: number;
  score_environment: number;
  score_labor: number;
  score_politics: number;
  score_social: number;
  attributes?: string[];
}

function useAlternatives(brandId: string, type: string) {
  return useQuery({
    queryKey: ["brand-alternatives", brandId, type],
    queryFn: async () => {
      // Try precomputed first via RPC
      const { data: precomputed } = await supabase.rpc("get_brand_alternatives" as any, {
        p_brand_id: brandId,
        p_type: type,
      });

      if (precomputed && (precomputed as any[]).length > 0) {
        return precomputed as Alternative[];
      }

      // Fallback to edge function for dynamic computation
      const { data, error } = await supabase.functions.invoke("get-alternatives", {
        body: { brand_id: brandId, type },
      });

      if (error) throw error;
      return (data?.alternatives || []) as Alternative[];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 10, // 10 min
  });
}

function AlternativeCard({ alt }: { alt: Alternative }) {
  const navigate = useNavigate();
  
  const topScore = Math.max(
    alt.score_environment ?? 0,
    alt.score_labor ?? 0,
    alt.score_politics ?? 0,
    alt.score_social ?? 0
  );

  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-green-600 dark:text-green-400";
    if (s >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="rounded-lg border bg-card p-4 hover:bg-accent/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {alt.logo_url ? (
            <img src={alt.logo_url} alt={alt.brand_name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-sm font-bold text-muted-foreground">
              {alt.brand_name?.[0]?.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-sm truncate">{alt.brand_name}</h4>
            <span className={`text-sm font-bold ${getScoreColor(topScore)}`}>
              {Math.round(alt.score)}
            </span>
          </div>

          {alt.parent_company && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{alt.parent_company}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alt.reason}</p>

          {/* Score drivers */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {alt.score_environment >= 60 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Leaf className="h-2.5 w-2.5 mr-0.5" /> Env {alt.score_environment}
              </Badge>
            )}
            {alt.score_labor >= 60 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Labor {alt.score_labor}
              </Badge>
            )}
            {alt.score_politics >= 60 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Vote className="h-2.5 w-2.5 mr-0.5" /> Pol {alt.score_politics}
              </Badge>
            )}
          </div>

          {/* Attributes */}
          {alt.attributes && alt.attributes.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {alt.attributes.slice(0, 3).map((attr) => (
                <Badge key={attr} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {attr.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-7 text-xs"
            onClick={() => navigate(`/brand/${alt.brand_id}`)}
          >
            View Profile
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyAlternatives({ type }: { type: string }) {
  const labels: Record<string, string> = {
    green: "green",
    local: "local",
    political: "politically aligned",
  };

  return (
    <div className="text-center py-6 px-4">
      <Info className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground">
        We're still collecting data on {labels[type] || ""} alternatives.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Check back soon — our coverage expands weekly.
      </p>
    </div>
  );
}

function AlternativesList({ brandId, type }: { brandId: string; type: string }) {
  const { data: alternatives, isLoading } = useAlternatives(brandId, type);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!alternatives || alternatives.length === 0) {
    return <EmptyAlternatives type={type} />;
  }

  return (
    <div className="space-y-2">
      {alternatives.map((alt) => (
        <AlternativeCard key={alt.brand_id} alt={alt} />
      ))}
    </div>
  );
}

export function AlternativesSection({ brandId, brandName }: AlternativesSectionProps) {
  const [activeTab, setActiveTab] = useState("green");

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold mb-1">Alternatives</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Brands that may align better with your priorities
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="green" className="flex-1 gap-1">
              <Leaf className="h-3.5 w-3.5" />
              Green
            </TabsTrigger>
            <TabsTrigger value="local" className="flex-1 gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Local
            </TabsTrigger>
            <TabsTrigger value="political" className="flex-1 gap-1">
              <Vote className="h-3.5 w-3.5" />
              Political
            </TabsTrigger>
          </TabsList>

          <TabsContent value="green">
            <AlternativesList brandId={brandId} type="green" />
          </TabsContent>
          <TabsContent value="local">
            <AlternativesList brandId={brandId} type="local" />
          </TabsContent>
          <TabsContent value="political">
            <AlternativesList brandId={brandId} type="political" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
