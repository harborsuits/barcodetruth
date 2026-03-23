import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Leaf, Building2, Info, ArrowRight, Loader2, Shield, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  company_type: string;
  alt_group: string;
}

function useSmartAlternatives(brandId: string) {
  return useQuery({
    queryKey: ["smart-alternatives", brandId],
    queryFn: async () => {
      // Try RPC directly first
      const { data, error } = await supabase.rpc("get_smart_alternatives" as any, {
        p_brand_id: brandId,
        p_limit: 12,
      });

      if (!error && data && (data as any[]).length > 0) {
        return data as Alternative[];
      }

      // Fallback to edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke("get-alternatives", {
        body: { brand_id: brandId },
      });

      if (fnError) throw fnError;
      return (fnData?.alternatives || []) as Alternative[];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 10,
  });
}

function AlternativeCard({ alt }: { alt: Alternative }) {
  const navigate = useNavigate();

  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-green-600 dark:text-green-400";
    if (s >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const isIndependent = alt.company_type === "independent" || alt.company_type === "local" || alt.company_type === "cooperative";

  return (
    <div className="rounded-lg border bg-card p-4 hover:bg-accent/30 transition-colors">
      <div className="flex items-start gap-3">
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
            <span className={`text-sm font-bold ${getScoreColor(alt.score)}`}>
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

          <div className="flex gap-1.5 mt-2 flex-wrap">
            {isIndependent && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <Shield className="h-2.5 w-2.5 mr-0.5" /> Independent
              </Badge>
            )}
            {alt.score_environment >= 65 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Leaf className="h-2.5 w-2.5 mr-0.5" /> Env {Math.round(alt.score_environment)}
              </Badge>
            )}
            {alt.score_labor >= 65 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Labor {Math.round(alt.score_labor)}
              </Badge>
            )}
          </div>

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

export function AlternativesSection({ brandId, brandName }: AlternativesSectionProps) {
  const { data: alternatives, isLoading } = useSmartAlternatives(brandId);

  const independent = alternatives?.filter(a => a.alt_group === "independent") || [];
  const mainstream = alternatives?.filter(a => a.alt_group === "mainstream") || [];

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold mb-1">Better Alternatives</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Brands in the same category — different ownership, stronger scores
        </p>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-4 space-y-0.5">
          <p className="font-medium text-foreground/70">Why these alternatives?</p>
          <p>✓ Different parent company than the scanned brand</p>
          <p>✓ Ranked by ethics score + ownership independence</p>
          <p>✓ Independent, local & co-op brands ranked higher</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !alternatives || alternatives.length === 0 ? (
          <div className="text-center py-6 px-4">
            <Info className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              We're still building alternatives for this category.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Check back soon — our coverage expands weekly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Independent alternatives first */}
            {independent.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-semibold">Independent & Local</span>
                </div>
                {independent.map(alt => (
                  <AlternativeCard key={alt.brand_id} alt={alt} />
                ))}
              </div>
            )}

            {/* Other scored alternatives */}
            {mainstream.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Higher Scoring Alternatives</span>
                </div>
                {mainstream.map(alt => (
                  <AlternativeCard key={alt.brand_id} alt={alt} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
