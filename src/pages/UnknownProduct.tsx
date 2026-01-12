import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Package, Camera, Loader2, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Contribution-focused page for unknown barcodes
// Goal: Turn "failure" into "you're early — help us identify it"

const CATEGORIES = [
  "Food & Beverages",
  "Personal Care",
  "Household",
  "Electronics",
  "Apparel",
  "Health & Wellness",
  "Baby & Kids",
  "Pet Care",
  "Other",
] as const;

export default function UnknownProduct() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  // Submit unknown product mutation
  const submitProduct = useMutation({
    mutationFn: async () => {
      if (!barcode || !productName.trim()) {
        throw new Error("Product name is required");
      }

      const { data, error } = await supabase.functions.invoke('submit-unknown-product', {
        body: {
          barcode,
          product_name: productName.trim(),
          brand_name: brandName.trim() || null,
          category: category || null,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSubmitted(true);
      toast({
        title: "Thanks for contributing!",
        description: "We're building this brand's profile now.",
      });

      // Navigate to the pending brand page after a delay
      setTimeout(() => {
        if (data?.brand_slug) {
          navigate(`/brand/${data.brand_slug}`, { state: { pending: true } });
        } else if (data?.brand_id) {
          navigate(`/brand/${data.brand_id}`, { state: { pending: true } });
        } else {
          navigate('/');
        }
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // No barcode provided
  if (!barcode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">No barcode provided</h2>
            <Button onClick={() => navigate('/scan')} className="w-full">
              Scan a Product
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container max-w-md mx-auto px-4 py-12">
          <Card>
            <CardContent className="pt-8 pb-8 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Thanks for contributing!</h2>
                <p className="text-sm text-muted-foreground">
                  We're building this brand's profile now.
                </p>
                <p className="text-sm text-muted-foreground">
                  You'll get an alert when it's ready.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <Trophy className="h-4 w-4" />
                <span>Early contributor</span>
              </div>
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
        <div className="container max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Add Product</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Hero section */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">
              We don't recognize this barcode yet
            </h2>
            <p className="text-sm text-muted-foreground">
              Add it now — it'll work instantly for everyone next time.
            </p>
            <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded inline-block">
              {barcode}
            </p>
          </CardContent>
        </Card>

        {/* Submission form */}
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Product Details</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product name (required) */}
            <div className="space-y-2">
              <Label htmlFor="product-name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-name"
                placeholder="e.g., Organic Whole Milk"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Brand name (optional) */}
            <div className="space-y-2">
              <Label htmlFor="brand-name">Brand Name (optional)</Label>
              <Input
                id="brand-name"
                placeholder="e.g., Horizon Organic"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If you don't know the brand, we'll try to identify it.
              </p>
            </div>

            {/* Category (optional) */}
            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit button */}
            <Button
              className="w-full"
              size="lg"
              onClick={() => submitProduct.mutate()}
              disabled={!productName.trim() || submitProduct.isPending}
            >
              {submitProduct.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit & Follow"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You'll be notified when this brand's profile is ready.
            </p>
          </CardContent>
        </Card>

        {/* Alternative actions */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate('/search')}
          >
            Search Existing Brands
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate('/scan')}
          >
            Scan Different Product
          </Button>
        </div>
      </main>
    </div>
  );
}
