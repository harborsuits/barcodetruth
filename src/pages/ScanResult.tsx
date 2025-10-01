import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Bookmark, Package, Share2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const lastScanRef = useRef<{ barcode: string; timestamp: number } | null>(null);

  // Debounce repeated scans (10s)
  useEffect(() => {
    if (!barcode) return;
    const now = Date.now();
    if (lastScanRef.current?.barcode === barcode && now - lastScanRef.current.timestamp < 10000) {
      return;
    }
    lastScanRef.current = { barcode, timestamp: now };
  }, [barcode]);

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
      
      // Filter by same product category
      const categoryQuery = supabase
        .from('products')
        .select('brand_id, category')
        .neq('brand_id', product!.brand_id);
      
      // Only filter by category if product has one
      if (product?.category) {
        categoryQuery.eq('category', product.category);
      }
      
      const { data: products, error: prodError } = await categoryQuery;
      if (prodError) throw prodError;
      
      // Extract unique brand IDs
      const brandIds = [...new Set(products?.map((p) => p.brand_id) ?? [])];
      
      if (brandIds.length === 0) return [];
      
      // Fetch brand scores for those alternatives
      const { data: brands, error: brandError } = await supabase
        .from('brands')
        .select('id, name, brand_scores!inner(score_labor, score_environment, score_politics, score_social)')
        .in('id', brandIds);
      
      if (brandError) throw brandError;
      
      // Cast and normalize brand_scores to array
      const normalized = (brands as any[]).map(brand => ({
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
            scores,
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
      if (!session) {
        setShowAuthDialog(true);
        throw new Error('auth_required');
      }

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
      if (error.message !== 'auth_required') {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  });

  const handleShare = async () => {
    if (!product || !brandData || !currentBrandData) return;
    
    const shareData = {
      title: `${product.name} - ${brandData.name}`,
      text: `Value Fit: ${currentBrandData.valueFit}/100`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      toast({
        title: 'Link copied',
        description: 'Share link copied to clipboard',
      });
    }
  };

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

                <ValueFitBar score={currentBrandData.valueFit} showExplainer />

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

            {/* Action buttons - sticky on mobile */}
            <div className="sticky bottom-0 bg-[var(--bg)] pt-2 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:static border-t sm:border-t-0">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleNotifications.mutate()}
                  disabled={toggleNotifications.isPending}
                >
                  {followData?.notifications_enabled ? (
                    <>
                      <Bell className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Following</span>
                    </>
                  ) : (
                    <>
                      <BellOff className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Notify</span>
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" disabled>
                  <Bookmark className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Save</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              </div>
            </div>

            {/* Alternatives */}
            {alternatives && (
              <AlternativesDrawer
                alternatives={alternatives}
                currentScore={currentBrandData.valueFit}
                currentScores={brandData.brand_scores[0]}
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

      {/* Auth Dialog */}
      <AlertDialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create a free account</AlertDialogTitle>
            <AlertDialogDescription>
              Sign up to save alerts and track brands that matter to you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Maybe later</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate('/auth')}>
              Sign up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
