import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, AlertCircle, ChevronRight, Loader2, Check, Save, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { EnrichmentStageProgress } from "@/components/brand/EnrichmentStageProgress";

// V1 Consumer Contract:
// - Product name (from barcode lookup) or "Unknown product"
// - Brand name (linked brand) or "Brand unknown"
// - Status: ready/building/unknown
// - CTA: "View Brand Profile" or "Search Brands"
// - NEW: Building state shows progress + optional correction form

// Optional correction form for building brands
function CorrectionForm({ 
  brandName, 
  onSubmit 
}: { 
  brandName: string; 
  onSubmit: (data: { name?: string; website?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !website.trim()) return;
    
    setSubmitting(true);
    await onSubmit({ 
      name: name.trim() || undefined, 
      website: website.trim() || undefined 
    });
    setSubmitting(false);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t">
      <p className="text-xs text-muted-foreground">
        Help improve this brand's data (optional)
      </p>
      <div className="space-y-2">
        <div>
          <Label htmlFor="brand-name" className="text-xs">Brand Name</Label>
          <Input 
            id="brand-name"
            placeholder={brandName || "Correct brand name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="brand-website" className="text-xs">Website</Label>
          <Input 
            id="brand-website"
            placeholder="example.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <Button 
        type="submit" 
        variant="outline" 
        size="sm" 
        className="w-full"
        disabled={submitting || (!name.trim() && !website.trim())}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Check className="h-4 w-4 mr-2" />
        )}
        Submit Correction
      </Button>
    </form>
  );
}

export default function ScanResultV1() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();
  const [showCorrection, setShowCorrection] = useState(false);
  const [saved, setSaved] = useState(false);

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

  // Query brand info (with polling for building status and enrichment stage)
  const { data: brandInfo, refetch: refetchBrand } = useQuery({
    queryKey: ['brand-info-v1', product?.brand_id],
    enabled: !!product?.brand_id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'stub' || status === 'building') {
        return 5000; // Poll every 5s while building
      }
      return false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, slug, status, logo_url, description, enrichment_stage, enrichment_stage_updated_at, enrichment_started_at')
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
  const brandIsFailed = brandInfo?.status === 'failed';
  const brandExists = Boolean(brandInfo?.id);

  // Auto-navigate to brand page when ready
  useEffect(() => {
    if (brandIsReady && brandInfo?.slug) {
      toast({
        title: "Profile ready!",
        description: `${brandInfo.name}'s profile is now available.`,
      });
      // Small delay to show the toast
      const timer = setTimeout(() => {
        navigate(`/brand/${brandInfo.slug}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [brandIsReady, brandInfo?.slug, brandInfo?.name, navigate]);

  // Save scan to user_scans
  const handleSaveScan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in to save scans", variant: "default" });
      return;
    }
    
    try {
      await supabase.from('user_scans').upsert({
        user_id: user.id,
        barcode,
        product_id: product?.id,
        brand_id: product?.brand_id,
        scanned_at: new Date().toISOString(),
      }, { onConflict: 'user_id,barcode' });
      
      setSaved(true);
      toast({ title: "Scan saved!", description: "Added to your scan history." });
    } catch (e) {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  // Submit correction
  const handleCorrection = async (data: { name?: string; website?: string }) => {
    if (!brandInfo?.id) return;
    
    try {
      // Update brand with corrections (admin will review)
      const updates: Record<string, any> = {};
      if (data.name) updates.name = data.name;
      if (data.website) {
        updates.website = data.website.startsWith('http') ? data.website : `https://${data.website}`;
        updates.canonical_domain = data.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase.from('brands').update(updates).eq('id', brandInfo.id);
        toast({ title: "Thanks!", description: "Your correction has been submitted." });
        setShowCorrection(false);
        refetchBrand();
      }
    } catch (e) {
      toast({ title: "Failed to submit", variant: "destructive" });
    }
  };

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

  // Product not found - redirect to unknown product submission page
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
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6 space-y-4 text-center">
              <Package className="h-12 w-12 mx-auto text-primary" />
              <h2 className="text-lg font-semibold">We don't recognize this barcode yet</h2>
              <p className="text-sm text-muted-foreground">
                Help us identify barcode <span className="font-mono">{barcode}</span> — it'll work instantly for everyone next time.
              </p>
              <div className="space-y-2 pt-2">
                <Button className="w-full" onClick={() => navigate(`/unknown/${barcode}`)}>
                  Add This Product
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate('/search')}>
                  Search Brands
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate('/scan')}>
                  Scan Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Brand is building - show dedicated building experience
  if (brandIsBuilding || brandIsFailed) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
          <div className="container max-w-md mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">Building Profile</h1>
            </div>
          </div>
        </header>

        <main className="container max-w-md mx-auto px-4 py-6 space-y-4">
          {/* Building State Card */}
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                  {brandIsFailed ? (
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                  ) : (
                    <Loader2 className="h-6 w-6 text-amber-600 animate-spin" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {brandIsFailed ? 'Profile needs review' : 'Building this profile'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {brandIsFailed 
                      ? 'We\'re verifying this brand\'s identity — usually takes a few minutes'
                      : 'ETA ~30 seconds — this page will update automatically'
                    }
                  </p>
                </div>
              </div>

              {/* Progress indicator with real stages */}
              <EnrichmentStageProgress 
                stage={brandInfo?.enrichment_stage as any}
                stageUpdatedAt={brandInfo?.enrichment_stage_updated_at}
                startedAt={brandInfo?.enrichment_started_at}
                status={brandInfo?.status || 'stub'}
                brandName={brandInfo?.name}
              />

              {/* Product info */}
              <div className="pt-2 border-t space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="font-medium">{product.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Brand</p>
                  <p className="font-medium">{brandInfo?.name || 'Unknown'}</p>
                </div>
              </div>

              {/* Save scan button */}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleSaveScan}
                disabled={saved}
              >
                {saved ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Saved to Your Scans
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save to My Scans
                  </>
                )}
              </Button>

              {/* Correction form toggle */}
              {!showCorrection ? (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setShowCorrection(true)}
                >
                  Help improve this brand's data
                </Button>
              ) : (
                <CorrectionForm 
                  brandName={brandInfo?.name || ''} 
                  onSubmit={handleCorrection}
                />
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => brandInfo?.slug && navigate(`/brand/${brandInfo.slug}`)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Profile Anyway
            </Button>
            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={() => navigate('/search')}
            >
              Search Other Brands
            </Button>
            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={() => navigate('/scan')}
            >
              Scan Another Product
            </Button>
          </div>

          {/* Beta notice */}
          <p className="text-xs text-center text-muted-foreground px-4">
            Early beta — new brands are enriched within minutes of first scan.
          </p>
        </main>
      </div>
    );
  }

  // Product found, brand ready - show success result
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

            {!brandExists && product.brand_id && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Brand data not available
                </span>
              </div>
            )}

            {/* CTA */}
            {brandIsReady && (
              <p className="text-sm text-center text-primary">
                Tap to view full brand profile →
              </p>
            )}
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
