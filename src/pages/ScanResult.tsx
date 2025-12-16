import { useState, useEffect, useRef } from "react";
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Bookmark, Package, Share2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ValueFitBar } from "@/components/ValueFitBar";
import { ValueMatchIndicator } from "@/components/ValueMatchIndicator";
import { WhyThisScore } from "@/components/WhyThisScore";
import { WhyCareCard } from "@/components/WhyCareCard";
import { BetterAlternativesCard } from "@/components/BetterAlternativesCard";
import { AlternativesDrawer } from "@/components/AlternativesDrawer";
import { CompareSheet } from "@/components/CompareSheet";
import { OwnershipDrawer } from "@/components/OwnershipDrawer";
import { EventCard, type BrandEvent } from "@/components/EventCard";
import { ReportIssue } from "@/components/ReportIssue";
import { ProductAlternativeCard } from "@/components/ProductAlternativeCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserWeights, calculateValueFit, getTopContributors } from "@/lib/valueFit";
import { getAlternatives } from "@/lib/alternatives";
import { getExcludeSameParent, getUserPreferences } from "@/lib/userPreferences";
import { buildWhyCare, shouldShowWhyCare } from "@/lib/whyCare";
import { analytics } from "@/lib/analytics";
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

import { FEATURES } from "@/config/features";

export default function ScanResult() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBrandId, setCompareBrandId] = useState<string | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const lastScanRef = useRef<{ barcode: string; timestamp: number } | null>(null);

  console.log('[ScanResult] barcode param:', barcode);

  // CRITICAL: Handle missing barcode - never show blank screen
  if (!barcode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">No barcode provided</h2>
            <p className="text-sm text-muted-foreground">
              Please scan a product barcode to see results.
            </p>
            <Button onClick={() => navigate('/scan')} className="w-full">
              Scan a Product
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Debounce repeated scans (10s)
  useEffect(() => {
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
      console.log('[ScanResult] querying products table for barcode:', barcode);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();
      
      console.log('[ScanResult] lookup response:', JSON.stringify({ data, error, barcode }, null, 2));
      
      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!barcode,
  });

  console.log('[ScanResult] Product state:', { product, productLoading, productError });

  // Query basic brand info (always needed for navigation)
  const { data: brandInfo } = useQuery({
    queryKey: ['brand-info', product?.brand_id],
    enabled: !!product?.brand_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name')
        .eq('id', product!.brand_id)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Query brand from Edge API
  const { data: brandData, isLoading: brandLoading } = useQuery({
    queryKey: ['brand-scores', product?.brand_id],
    enabled: FEATURES.companyScore && Boolean(product?.brand_id),
    queryFn: async () => {
      try {
        const API = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/v1-brands";
        const res = await fetch(`${API}/brands/${product!.brand_id}`);
        if (!res.ok) return null;
        const data = await res.json();
        // Skip brands without verified scores (no defaults!)
        if (!data.score || !data.last_event_at) {
          return null;
        }
        // Convert Edge API response to expected format
        return {
          id: data.brand_id,
          name: data.name,
          brand_scores: [{
            score_labor: data.score,
            score_environment: data.score,
            score_politics: data.score,
            score_social: data.score,
          }]
        } as BrandWithScores;
      } catch (e) {
        console.error('[ScanResult] brand fetch failed:', e);
        return null;
      }
    },
  });

  // Fallback: direct brand_scores table if API is failing
  const { data: brandScores } = useQuery({
    queryKey: ['brand-scores-fallback', product?.brand_id],
    enabled: !!product?.brand_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_scores')
        .select('score_labor, score_environment, score_politics, score_social')
        .eq('brand_id', product!.brand_id)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as BrandScores | null;
    },
  });

  // Fetch recent brand events (last 12 months)
  const { data: recentEvents } = useQuery({
    queryKey: ['recentEvents', product?.brand_id],
    queryFn: async () => {
      if (!product?.brand_id) return [];
      
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const { data, error } = await supabase
        .from('brand_events')
        .select(`
          *,
          event_sources(*)
        `)
        .eq('brand_id', product.brand_id)
        .gte('event_date', twelveMonthsAgo.toISOString())
        .order('event_date', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!product?.brand_id,
  });

  // Calculate score drivers from events
  const scoreDrivers = recentEvents?.reduce((acc, event) => {
    const categories = ['labor', 'environment', 'politics', 'social'] as const;
    
    categories.forEach(cat => {
      const impactKey = `impact_${cat}` as keyof typeof event;
      const impact = event[impactKey] as number | null;
      
      if (impact && impact < 0) { // Only show negative impacts
        if (!acc[cat]) {
          acc[cat] = {
            category: cat,
            categoryLabel: cat.charAt(0).toUpperCase() + cat.slice(1),
            impact: 0,
            eventCount: 0,
            events: []
          };
        }
        acc[cat].impact += impact;
        acc[cat].eventCount += 1;
        if (acc[cat].events.length < 3) { // Top 3 events per category
          acc[cat].events.push(event);
        }
      }
    });
    
    return acc;
  }, {} as Record<string, any>);

  const topDrivers = scoreDrivers 
    ? Object.values(scoreDrivers)
        .sort((a: any, b: any) => a.impact - b.impact) // Most negative first
        .slice(0, 4) // Top 4 categories
    : [];

  // Query recent events for display (separate from scoring)
  const { data: events } = useQuery({
    queryKey: ['brand-events', product?.brand_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_events')
        .select('*')
        .eq('brand_id', product!.brand_id)
        .order('event_date', { ascending: false })
        .limit(3);
      
      console.log('[ScanResult] Events query result:', {
        brand_id: product!.brand_id,
        events_count: data?.length ?? 0,
        first_event: data?.[0],
        error: error,
        query_enabled: !!product?.brand_id
      });
      
      if (error) throw error;
      return data as BrandEvent[];
    },
    enabled: !!product?.brand_id,
  });

  // Query alternatives (same category, sorted by Value Fit, excluding same parent if setting is on)
  const { data: alternatives } = useQuery({
    queryKey: ['alternatives', product?.brand_id, product?.category],
    queryFn: async () => {
      if (!product?.brand_id) return [];
      
      const excludeSameParent = await getExcludeSameParent();
      const alts = await getAlternatives(
        product.brand_id,
        product.category,
        excludeSameParent
      );
      
      // Map to the expected format for AlternativesDrawer
      return alts.map(alt => ({
        brand_id: alt.brandId,
        brand_name: alt.brandName,
        valueFit: alt.valueFit,
        overall_score: Math.round(
          (alt.scores.score_labor + 
           alt.scores.score_environment + 
           alt.scores.score_politics + 
           alt.scores.score_social) / 4
        ),
        why: alt.reasons,
        price_context: undefined,
        scores: alt.scores,
      }));
    },
    enabled: !!product?.brand_id,
  });

  // Query product-level alternatives using the new edge function
  const { data: productAlternatives } = useQuery({
    queryKey: ['product-alternatives', product?.barcode],
    queryFn: async () => {
      if (!product?.barcode) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('get-better-alternatives', {
        body: {
          barcode: product.barcode,
          user_id: session?.user?.id,
          limit: 5
        }
      });
      
      console.log('[ScanResult] Product alternatives result:', { data, error });
      
      if (error) {
        console.error('Error fetching product alternatives:', error);
        return [];
      }
      
      return data?.alternatives || [];
    },
    enabled: !!product?.barcode,
  });

  console.log('[ScanResult] Product alternatives state:', productAlternatives);

  // Query compare brand from Edge API
  const { data: compareBrand } = useQuery({
    queryKey: ['compare-brand', compareBrandId],
    queryFn: async () => {
      const API = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/v1-brands";
      const weights = getUserWeights();
      
      const res = await fetch(`${API}/brands/${compareBrandId!}`);
      if (!res.ok) throw new Error('Failed to fetch compare brand');
      
      const brandData = await res.json();
      
      const { data: brandEvents, error: eventsError } = await supabase
        .from('brand_events')
        .select('*')
        .eq('brand_id', compareBrandId!)
        .order('event_date', { ascending: false })
        .limit(2);
      
      if (eventsError) throw eventsError;
      
      // Skip brands without verified scores
      if (!brandData.score || !brandData.last_event_at) {
        throw new Error('No verified score for comparison brand');
      }
      
      const scores = {
        score_labor: brandData.score,
        score_environment: brandData.score,
        score_politics: brandData.score,
        score_social: brandData.score,
      };
      const valueFit = calculateValueFit(scores, weights);
      
      return {
        brand_id: brandData.brand_id,
        brand_name: brandData.name,
        valueFit,
        scores: {
          labor: brandData.score,
          environment: brandData.score,
          politics: brandData.score,
          social: brandData.score,
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

  // Calculate current brand data BEFORE using it in handlers
  const resolvedScores = brandData?.brand_scores?.[0] || brandScores || null;
  const currentBrandData = resolvedScores && {
    brand_id: product?.brand_id || '',
    brand_name: brandData?.name || brandInfo?.name || 'Brand',
    valueFit: calculateValueFit(resolvedScores, getUserWeights()),
    scores: {
      labor: resolvedScores.score_labor,
      environment: resolvedScores.score_environment,
      politics: resolvedScores.score_politics,
      social: resolvedScores.score_social,
    },
    events: events ?? [],
  };

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

  // Query owner guess from resolve-barcode (GS1 fallback)
  const { data: ownerGuess, isLoading: ownerGuessLoading } = useQuery({
    queryKey: ['owner-guess', barcode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('resolve-barcode', {
        body: { barcode }
      });
      
      if (error || !data?.success) return null;
      return data?.owner_guess || null;
    },
    enabled: !!productError && !!barcode,
  });

  // Submit product claim mutation
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const submitClaim = useMutation({
    mutationFn: async ({ brandId, productName }: { brandId: string; productName?: string }) => {
      const { data, error } = await supabase.functions.invoke('submit-product-claim', {
        body: {
          barcode,
          brand_id: brandId,
          product_name: productName,
          source_hint: 'gs1_confirm'
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPendingClaimId(data.claim_id);
      
      toast({
        title: 'Product added!',
        description: 'Navigating in 10 seconds... (or undo below)',
      });
      
      // Auto-navigate after 10s if not undone
      undoTimeoutRef.current = setTimeout(async () => {
        // Safety check: verify brand still exists before navigating
        if (ownerGuess?.brand_id) {
          const { data: brandExists } = await supabase
            .from('brands')
            .select('id')
            .eq('id', ownerGuess.brand_id)
            .maybeSingle();
          
          if (brandExists) {
            queryClient.invalidateQueries({ queryKey: ['product', barcode] });
            navigate(`/brands/${ownerGuess.brand_id}`, { replace: true });
          } else {
            toast({
              title: 'Brand unavailable',
              description: 'The brand page is not currently available.',
              variant: 'destructive',
            });
          }
        }
        setPendingClaimId(null);
      }, 10000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Submission failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleUndo = async () => {
    if (!pendingClaimId) return;
    
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    
    // Delete the claim using service role (or mark as cancelled)
    const { error } = await supabase
      .from('product_claims' as any)
      .delete()
      .eq('id', pendingClaimId);
    
    if (!error) {
      toast({
        title: 'Claim removed',
        description: 'Your submission has been cancelled.',
      });
      setPendingClaimId(null);
    } else {
      toast({
        title: 'Undo failed',
        description: 'Could not remove claim. Please contact support.',
        variant: 'destructive',
      });
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  if (productError) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center space-y-2">
              <Package className="h-12 w-12 mx-auto text-[var(--muted)]" />
              <h2 className="text-lg font-semibold">Product not found</h2>
              <p className="text-sm text-muted-foreground">
                Couldn't find barcode <span className="font-mono">{barcode}</span> in our database.
              </p>
            </div>

            {ownerGuessLoading && (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {!ownerGuessLoading && ownerGuess && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="pt-4 pb-4 space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Likely owned by:</div>
                    <div className="text-lg font-semibold">{ownerGuess.brand_name || ownerGuess.company_name}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {Math.round(ownerGuess.confidence)}% confidence
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        via {ownerGuess.method}
                      </Badge>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${ownerGuess.confidence}%` }}
                      />
                    </div>
                  </div>

                  {ownerGuess.brand_id && (
                    <>
                      <div className="text-sm text-muted-foreground">
                        This guess is based on the barcode prefix. Is this correct?
                      </div>
                      
                      {pendingClaimId ? (
                        <div className="space-y-2">
                          <div className="p-3 bg-background rounded-lg border border-primary/50">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium">Claim submitted</div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={handleUndo}
                              >
                                Undo
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Navigating in 10 seconds...
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Button 
                            className="w-full"
                            onClick={() => submitClaim.mutate({ brandId: ownerGuess.brand_id! })}
                            disabled={submitClaim.isPending}
                          >
                            {submitClaim.isPending ? 'Confirming...' : '✓ Yes, confirm'}
                          </Button>
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => navigate('/search')}
                          >
                            Pick another brand
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {!ownerGuess.brand_id && (
                    <div className="text-sm text-muted-foreground">
                      We found the manufacturer ({ownerGuess.company_name}) but don't have alignment data yet. 
                      Search for the brand manually.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Button 
                className="w-full" 
                onClick={() => navigate('/search')}
              >
                Search Manually
              </Button>
              <ReportIssue
                subjectType="product"
                subjectId={barcode || 'unknown'}
                trigger={
                  <Button variant="outline" className="w-full">
                    Add This Product
                  </Button>
                }
              />
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => navigate('/scan')}
              >
                Scan Again
              </Button>
            </div>
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
        {productLoading ? (
          <>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Looking up barcode</p>
                  <p className="font-mono text-lg">{barcode}</p>
                </div>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          </>
        ) : product ? (
          <>
            {/* Product + Brand Info */}
            <Card 
              className="cursor-pointer hover:bg-accent/5 transition-colors"
              onClick={() => navigate(`/brand/${product.brand_id}`)}
            >
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <h2 className="text-lg font-semibold">{product.name}</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-[var(--muted)]">
                        {brandData?.name || brandInfo?.name || 'Loading brand...'}
                      </p>
                      {(brandData || brandInfo) && (
                        <OwnershipDrawer 
                          brandId={product.brand_id} 
                          brandName={brandData?.name || brandInfo?.name || ''} 
                        />
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {product.category ?? 'General'}
                  </Badge>
                </div>

                {currentBrandData ? (
                  <ValueFitBar score={currentBrandData.valueFit} showExplainer />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <Package className="h-4 w-4" />
                    Scores coming soon
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Tap to view full brand profile →
                </p>

              </CardContent>
            </Card>

            {/* Why Should I Care - Personalized explanation */}
            {brandData && currentBrandData && (() => {
              const weights = getUserWeights();
              const userValues = {
                labor: weights.labor * 100,
                environment: weights.environment * 100,
                politics: weights.politics * 100,
                social: weights.social * 100,
              };
              
              if (!shouldShowWhyCare(userValues)) return null;
              
              const bullets = buildWhyCare(userValues, brandData.brand_scores[0]);
              
              return (
                <WhyCareCard 
                  bullets={bullets}
                  onShowEvidence={(category) => {
                    navigate(`/brand/${product.brand_id}#${category}`);
                  }}
                />
              );
            })()}

            {/* Better Alternatives - Only show if match < 70% */}
            {brandData && currentBrandData && currentBrandData.valueFit < 70 && alternatives && alternatives.length > 0 && (
              <BetterAlternativesCard
                alternatives={alternatives}
                currentMatch={currentBrandData.valueFit}
                currentBrandId={product.brand_id}
                onCompare={(brandId) => {
                  analytics.trackCompareClicked(product.brand_id, brandId);
                  setCompareBrandId(brandId);
                  setCompareOpen(true);
                }}
              />
            )}

            {/* Product-Level Alternatives */}
            {productAlternatives && productAlternatives.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="text-base font-semibold">Specific Products You Can Buy</h3>
                  {currentBrandData && (
                    <p className="text-sm text-muted-foreground">
                      Based on your values ({Math.round(currentBrandData.valueFit)}% match with current product)
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {productAlternatives.map((alt: any) => (
                    <ProductAlternativeCard key={alt.barcode} alternative={alt} />
                  ))}
                </CardContent>
              </Card>
            )}

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
            {brandData && currentBrandData && alternatives && (
              <AlternativesDrawer
                alternatives={alternatives}
                currentScore={currentBrandData.valueFit}
                currentScores={brandData.brand_scores[0]}
                productCategory={product.category}
                onCompare={(brandId) => {
                  setCompareBrandId(brandId);
                  setCompareOpen(true);
                }}
              />
            )}

            {/* Recent activity */}
            {(() => {
              console.log('[ScanResult] Recent Activity render check:', {
                events_exists: !!events,
                events_length: events?.length ?? 0,
                events_sample: events?.[0],
                current_brand_events: currentBrandData?.events?.length ?? 0
              });
              
              return events && events.length > 0 && (
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
              );
            })()}
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
