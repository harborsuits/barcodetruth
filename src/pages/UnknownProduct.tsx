import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Package, Camera, Loader2, Check, ShieldCheck, Upload, X, Search, ScanLine } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export default function UnknownProduct() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Photo must be an image", variant: "destructive" });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast({ title: "Photo too large", description: "Please choose an image under 5 MB.", variant: "destructive" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submitProduct = useMutation({
    mutationFn: async () => {
      if (!barcode || !productName.trim()) throw new Error("Product name is required");
      if (!photoFile) throw new Error("A product photo is required");

      // Auth check — uploads need a logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Please sign in to submit a product.");
      }

      setUploading(true);
      // Upload photo to private bucket under user's folder
      const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${barcode}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-submissions")
        .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
      if (uploadError) {
        setUploading(false);
        throw uploadError;
      }
      // Signed URL (24h) for the edge function to record
      const { data: signed } = await supabase.storage
        .from("product-submissions")
        .createSignedUrl(path, 60 * 60 * 24);
      setUploading(false);

      const { data, error } = await supabase.functions.invoke("submit-unknown-product", {
        body: {
          barcode,
          product_name: productName.trim(),
          brand_name: brandName.trim() || null,
          category: category || null,
          photo_url: signed?.signedUrl || null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSubmitted(true);
      try {
        const raw = localStorage.getItem("recent_scans");
        const all = raw ? JSON.parse(raw) : [];
        const entry = {
          upc: barcode,
          product_name: productName.trim(),
          brand_name: brandName.trim() || undefined,
          timestamp: Date.now(),
          status: data?.status || "pending",
        };
        const filtered = all.filter((s: any) => s.upc !== barcode);
        localStorage.setItem("recent_scans", JSON.stringify([entry, ...filtered].slice(0, 50)));
      } catch (e) {
        console.warn("Failed to save to scan history:", e);
      }

      if (data?.status === "recognized" || data?.already_exists) {
        toast({ title: "We already recognize this product", description: "Loading its profile…" });
        setTimeout(() => {
          navigate(`/scan-result/${barcode}`, {
            state: {
              justSubmitted: true,
              alreadyExisted: true,
              product: data?.product,
              brand: data?.brand,
              brandSlug: data?.brand_slug,
              source: "submit-unknown-product",
            },
          });
        }, 1200);
      } else {
        toast({
          title: "Submission received",
          description: "Building this brand's profile now — your photo helps verify accuracy.",
        });
        setTimeout(() => {
          navigate(`/scan-result/${barcode}`, {
            state: {
              justSubmitted: true,
              product: data?.product,
              brand: data?.brand,
              brandSlug: data?.brand_slug,
              source: "submit-unknown-product",
            },
          });
        }, 1500);
      }
    },
    onError: (error: Error) => {
      setUploading(false);
      toast({
        title: "Submission failed",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  if (!barcode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">No barcode provided</h2>
            <Button onClick={() => navigate("/scan")} className="w-full">
              Scan a Product
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                <h2 className="text-xl font-semibold">Submission received</h2>
                <p className="text-sm text-muted-foreground">
                  Your product is live now and flagged as <span className="font-medium">community-submitted</span> until our team verifies the photo.
                </p>
                <p className="text-xs text-muted-foreground">
                  If something doesn't match, we may correct or remove it during review.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <Trophy className="h-4 w-4" />
                <span>Early contributor — thanks!</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Enrichment in progress…</span>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const canSubmit = !!productName.trim() && !!photoFile && !submitProduct.isPending && !uploading;

  return (
    <div className="min-h-screen bg-background">
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
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">We don't recognize this barcode yet</h2>
            <p className="text-sm text-muted-foreground">
              Add it now — it'll work instantly for everyone next time.
            </p>
            <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded inline-block">
              {barcode}
            </p>
          </CardContent>
        </Card>

        {/* Primary actions: search or scan again come first */}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => navigate("/search")} variant="default" className="w-full">
            <Search className="h-4 w-4 mr-2" />
            Search by brand
          </Button>
          <Button onClick={() => navigate("/scan")} variant="secondary" className="w-full">
            <ScanLine className="h-4 w-4 mr-2" />
            Scan another label
          </Button>
        </div>

        {/* Transparency: what happens with submissions */}
        <Card className="border-border bg-elevated-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">How submissions work</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Submissions go live immediately and are flagged as <span className="font-medium">community-submitted</span> until our team verifies the photo. A clear photo of the front of the package is required so we can check accuracy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Product (collapsed by default) */}
        <Collapsible open={showSubmitForm} onOpenChange={setShowSubmitForm}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              {showSubmitForm ? "Hide submission form" : "Submit this product"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold">Product Details</h3>
                <p className="text-xs text-muted-foreground">
                  What we need: a clear photo of the front of the package. Submissions are reviewed before being trusted.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Photo upload (REQUIRED — soft gate) */}
                <div className="space-y-2">
                  <Label>
                    Product Photo <span className="text-destructive">*</span>
                  </Label>
                  {photoPreview ? (
                    <div className="relative w-full aspect-square max-h-64 rounded border border-border overflow-hidden bg-muted">
                      <img src={photoPreview} alt="Product preview" className="w-full h-full object-contain" />
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={clearPhoto}
                        type="button"
                        aria-label="Remove photo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-video rounded border-2 border-dashed border-border hover:border-primary/50 hover:bg-elevated-1 transition-colors flex flex-col items-center justify-center gap-2 p-4"
                    >
                      <Camera className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-foreground">Take or upload a photo</p>
                      <p className="text-xs text-muted-foreground">Show the front of the package — JPG/PNG, ≤5 MB</p>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  {!photoFile && (
                    <p className="text-xs text-muted-foreground">A clear photo helps us verify the brand and prevents bad data.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-name">
                    Product Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="product-name"
                    placeholder="e.g., Organic Whole Milk"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    maxLength={120}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand-name">Brand Name (optional)</Label>
                  <Input
                    id="brand-name"
                    placeholder="e.g., Horizon Organic"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    maxLength={80}
                  />
                  <p className="text-xs text-muted-foreground">If you don't know the brand, we'll try to identify it.</p>
                </div>

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

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => submitProduct.mutate()}
                  disabled={!canSubmit}
                >
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading photo…</>
                  ) : submitProduct.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" />Submit & Follow</>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  You'll be notified when this brand's profile is ready.
                </p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </main>
    </div>
  );
}
