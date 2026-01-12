import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, AlertCircle, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

// V1 Consumer Contract:
// - Product name (from barcode lookup) or "Unknown product"
// - Brand name (linked brand) or "Brand unknown"
// - Status: ready/building/unknown
// - CTA: "View Brand Profile" or "Search Brands"

export default function ScanResultV1() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();

  // No barcode provided
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

  // Query product by barcode
  const { data: product, isLoading: productLoading, error: productError } = useQuery({
    queryKey: ['product-v1', barcode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, barcode, name, brand_id, category')
        .eq('barcode', barcode)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!barcode,
  });

  // Query brand info (with polling for building status)
  const { data: brandInfo } = useQuery({
    queryKey: ['brand-info-v1', product?.brand_id],
    enabled: !!product?.brand_id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'stub' || status === 'building') {
        return 10000; // Poll every 10s while building
      }
      return false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, slug, status')
        .eq('id', product!.brand_id)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Determine states
  const brandIsReady = brandInfo?.status === 'ready';
  const brandIsBuilding = brandInfo?.status === 'stub' || brandInfo?.status === 'building';
  const brandExists = Boolean(brandInfo?.id);

  // Loading state
  if (productLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
          <div className="container max-w-md mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">Scan Result</h1>
            </div>
          </div>
        </header>
        <main className="container max-w-md mx-auto px-4 py-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Looking up barcode</p>
                <p className="font-mono text-lg">{barcode}</p>
              </div>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Product not found
  if (productError || !product) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
          <div className="container max-w-md mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">Scan Result</h1>
            </div>
          </div>
        </header>
        <main className="container max-w-md mx-auto px-4 py-6">
          <Card>
            <CardContent className="pt-6 space-y-4 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="text-lg font-semibold">Product not found</h2>
              <p className="text-sm text-muted-foreground">
                We don't recognize barcode <span className="font-mono">{barcode}</span> yet.
              </p>
              <div className="space-y-2 pt-2">
                <Button className="w-full" onClick={() => navigate('/search')}>
                  Search Brands
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate('/scan')}>
                  Scan Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Product found - show result
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Scan Result</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Product + Brand Card */}
        <Card 
          className={brandIsReady ? "cursor-pointer hover:bg-accent/5 transition-colors" : ""}
          onClick={() => {
            if (brandIsReady && brandInfo?.slug) {
              navigate(`/brand/${brandInfo.slug}`);
            }
          }}
        >
          <CardContent className="pt-6 space-y-4">
            {/* Product name */}
            <div>
              <p className="text-sm text-muted-foreground">Product</p>
              <h2 className="text-lg font-semibold">{product.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                This product's profile reflects the broader practices of its brand.
              </p>
            </div>

            {/* Brand name + status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Brand</p>
                <p className="font-medium">
                  {brandInfo?.name || 'Brand unknown'}
                </p>
              </div>
              
              {brandIsReady && (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            {/* Status indicator */}
            {brandIsBuilding && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  Brand profile building... (auto-refreshing)
                </span>
              </div>
            )}

            {!brandExists && product.brand_id && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Brand data not available
                </span>
              </div>
            )}

            {/* CTA */}
            {brandIsReady ? (
              <p className="text-sm text-center text-primary">
                Tap to view full brand profile →
              </p>
            ) : brandIsBuilding ? (
              <p className="text-xs text-center text-muted-foreground">
                Check back soon or search brands below
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="space-y-2">
          {brandIsReady && brandInfo?.slug && (
            <Button 
              className="w-full" 
              onClick={() => navigate(`/brand/${brandInfo.slug}`)}
            >
              View Brand Profile
            </Button>
          )}
          <Button 
            variant={brandIsReady ? "outline" : "default"} 
            className="w-full" 
            onClick={() => navigate('/search')}
          >
            Search Brands
          </Button>
          <Button 
            variant="ghost" 
            className="w-full" 
            onClick={() => navigate('/scan')}
          >
            Scan Another Product
          </Button>
        </div>

        {/* Early beta notice */}
        <p className="text-xs text-center text-muted-foreground px-4">
          Early beta — not all products are in our database yet.
        </p>
      </main>
    </div>
  );
}
