import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Bookmark, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ValueFitBar } from "@/components/ValueFitBar";
import { AlternativesDrawer } from "@/components/AlternativesDrawer";
import { CompareSheet } from "@/components/CompareSheet";
import { EventCard, type BrandEvent } from "@/components/EventCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserWeights, calculateValueFit } from "@/lib/valueFit";

interface Product {
  id: string;
  barcode: string;
  name: string;
  brand_id: string;
  category?: string;
}

interface BrandScores {
  score_labor: number;
  score_environment: number;
  score_politics: number;
  score_social: number;
}

interface BrandWithScores {
  id: string;
  name: string;
  brand_scores: BrandScores[];
}

export default function ScanResult() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBrandId, setCompareBrandId] = useState<string | null>(null);

  // Query product by barcode
  const { data: product, isLoading: productLoading, error: productError } = useQuery({
    queryKey: ['product', barcode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();
      
      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!barcode,
  });

  // Query brand + scores
  const { data: brandData, isLoading: brandLoading } = useQuery({
    queryKey: ['brand-scores', product?.brand_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, brand_scores!inner(score_labor, score_environment, score_politics, score_social)')
        .eq('id', product!.brand_id)
        .single();
      
      if (error) throw error;
      
      // Cast the nested brand_scores correctly
      return {
        ...data,
        brand_scores: Array.isArray(data.brand_scores) ? data.brand_scores : [data.brand_scores]
      } as BrandWithScores;
    },
    enabled: !!product?.brand_id,
  });

  // Query recent events for this brand
  const { data: events } = useQuery({
    queryKey: ['brand-events', product?.brand_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_events')
        .select('*')
        .eq('brand_id', product!.brand_id)
        .order('occurred_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      return data as BrandEvent[];
    },
    enabled: !!product?.brand_id,
  });

  // Query alternatives (same category, sorted by Value Fit)
  const { data: alternatives } = useQuery({
    queryKey: ['alternatives', product?.brand_id, product?.category],
    queryFn: async () => {
      const weights = getUserWeights();
      
      // Get all brands in same category (or all if no category)
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, brand_scores!inner(score_labor, score_environment, score_politics, score_social)')
        .neq('id', product!.brand_id)
        .limit(10);
      
      if (error) throw error;
      
      // Cast and normalize brand_scores to array
      const normalized = (data as any[]).map(brand => ({
        ...brand,
        brand_scores: Array.isArray(brand.brand_scores) ? brand.brand_scores : [brand.brand_scores]
      })) as BrandWithScores[];
      
      // Calculate Value Fit for each and sort
      return normalized
        .map((brand) => {
          const scores = brand.brand_scores[0];
          const valueFit = calculateValueFit(scores, weights);
          return {
            brand_id: brand.id,
            brand_name: brand.name,
            valueFit,
            overall_score: Math.round((scores.score_labor + scores.score_environment + scores.score_politics + scores.score_social) / 4),
            why: `Better alignment with your priorities.`,
            price_context: undefined,
          };
        })
        .sort((a, b) => b.valueFit - a.valueFit)
        .slice(0, 5);
    },
    enabled: !!product?.brand_id,
  });

  // Query compare brand data
  const { data: compareBrand } = useQuery({
    queryKey: ['compare-brand', compareBrandId],
    queryFn: async () => {
      const weights = getUserWeights();
      
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id, name, brand_scores!inner(score_labor, score_environment, score_politics, score_social)')
        .eq('id', compareBrandId!)
        .single();
      
      if (brandError) throw brandError;
      
      // Normalize brand_scores to array
      const brandWithScores = {
        ...brand,
        brand_scores: Array.isArray(brand.brand_scores) ? brand.brand_scores : [brand.brand_scores]
      } as BrandWithScores;
      
      const { data: brandEvents, error: eventsError } = await supabase
        .from('brand_events')
        .select('*')
        .eq('brand_id', compareBrandId!)
        .order('occurred_at', { ascending: false })
        .limit(2);
      
      if (eventsError) throw eventsError;
      
      const scores = brandWithScores.brand_scores[0];
      const valueFit = calculateValueFit(scores, weights);
      
      return {
        brand_id: brandWithScores.id,
        brand_name: brandWithScores.name,
        valueFit,
        scores: {
          labor: scores.score_labor,
          environment: scores.score_environment,
          politics: scores.score_politics,
          social: scores.score_social,
        },
        events: brandEvents as BrandEvent[],
      };
    },
    enabled: !!compareBrandId,
  });

  // Query notification status
  const { data: followData } = useQuery({
    queryKey: ['follow', product?.brand_id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data, error } = await supabase
        .from('user_follows')
        .select('notifications_enabled')
        .eq('brand_id', product!.brand_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!product?.brand_id,
  });

  // Toggle notifications mutation
  const toggleNotifications = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in to enable notifications');

      const enabled = !followData?.notifications_enabled;
      const { error } = await supabase
        .from('user_follows')
        .upsert(
          { 
            brand_id: product!.brand_id, 
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
          ? "We'll notify you on score changes."
          : 'You can re-enable anytime.'
      });
      queryClient.invalidateQueries({ queryKey: ['follow', product?.brand_id] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const currentBrandData = brandData && {
    brand_id: brandData.id,
    brand_name: brandData.name,
    valueFit: brandData.brand_scores[0] ? calculateValueFit(brandData.brand_scores[0], getUserWeights()) : 50,
    scores: {
      labor: brandData.brand_scores[0]?.score_labor ?? 50,
      environment: brandData.brand_scores[0]?.score_environment ?? 50,
      politics: brandData.brand_scores[0]?.score_politics ?? 50,
      social: brandData.brand_scores[0]?.score_social ?? 50,
    },
    events: events ?? [],
  };

  if (productError) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Package className="h-12 w-12 mx-auto text-[var(--muted)]" />
            <h2 className="text-lg font-semibold">Product not found</h2>
            <p className="text-sm text-muted-foreground">
              We couldn't find this product. Try scanning again or tell us the brand.
            </p>
            <Button onClick={() => navigate('/scan')}>
              Scan Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-screen-md mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Scan Result</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-screen-md mx-auto px-4 sm:px-6 py-6 space-y-6">
        {(productLoading || brandLoading) ? (
          <>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          </>
        ) : product && brandData && currentBrandData ? (
          <>
            {/* Product + Brand Info */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{product.name}</h2>
                    <p className="text-sm text-[var(--muted)]">{brandData.name}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {product.category ?? 'General'}
                  </Badge>
                </div>

                <ValueFitBar score={currentBrandData.valueFit} />

                {/* Quick explanation */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentBrandData.valueFit >= 70
                    ? "This matches your priorities."
                    : currentBrandData.valueFit >= 50
                    ? "Some trade-offs vs your priorities."
                    : "Doesn't match what you care about—want a better alternative?"}
                </p>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => toggleNotifications.mutate()}
                disabled={toggleNotifications.isPending}
              >
                {followData?.notifications_enabled ? (
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
              <Button variant="outline" disabled>
                <Bookmark className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>

            {/* Alternatives */}
            {alternatives && (
              <AlternativesDrawer
                alternatives={alternatives}
                currentScore={currentBrandData.valueFit}
                onCompare={(brandId) => {
                  setCompareBrandId(brandId);
                  setCompareOpen(true);
                }}
              />
            )}

            {/* Recent activity */}
            {events && events.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <h3 className="text-base font-semibold">Recent Activity</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {events.map((event) => (
                    <EventCard key={event.event_id} event={event} compact />
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </main>

      {/* Compare Sheet */}
      {currentBrandData && compareBrand && (
        <CompareSheet
          open={compareOpen}
          onOpenChange={setCompareOpen}
          current={currentBrandData}
          alternative={compareBrand}
        />
      )}
    </div>
  );
}
