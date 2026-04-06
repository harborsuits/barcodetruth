import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Package, AlertCircle, Loader2, Check, Save, ExternalLink, Search, Users, TrendingUp, HelpCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AlternativesSection } from "@/components/brand/AlternativesSection";
import { EnrichmentStageProgress } from "@/components/brand/EnrichmentStageProgress";
import { TrustVerdict } from "@/components/scan/TrustVerdict";
import { ScoreBreakdownCard } from "@/components/scan/ScoreBreakdownCard";
import { formatCategory } from "@/lib/formatCategory";
import { formatBrandName, formatProductName } from "@/lib/formatBrandName";
import { OwnershipReveal } from "@/components/scan/OwnershipReveal";
import { ShareCard, getGrade } from "@/components/scan/ShareCard";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { useDisplayProfile } from "@/hooks/useDisplayProfile";

// ─── Correction form (unchanged) ───
function CorrectionForm({ brandName, onSubmit }: { brandName: string; onSubmit: (data: { name?: string; website?: string }) => void }) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && !website.trim()) return;
    setSubmitting(true);
    await onSubmit({ name: name.trim() || undefined, website: website.trim() || undefined });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t">
      <p className="text-xs text-muted-foreground">Help improve this brand's data (optional)</p>
      <div className="space-y-2">
        <div>
          <Label htmlFor="brand-name" className="text-xs">Brand Name</Label>
          <Input id="brand-name" placeholder={brandName || "Correct brand name"} value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label htmlFor="brand-website" className="text-xs">Website</Label>
          <Input id="brand-website" placeholder="example.com" value={website} onChange={(e) => setWebsite(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>
      <Button type="submit" variant="outline" size="sm" className="w-full" disabled={submitting || (!name.trim() && !website.trim())}>
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
        Submit Correction
      </Button>
    </form>
  );
}

// ─── Score reason generator ───
function buildReasons(scores: any, evidenceCounts: Record<string, number>, parentName?: string | null, brandName?: string): string[] {
  const reasons: string[] = [];
  const s = scores || {};

  if (s.score_labor != null && s.score_labor < 45) {
    const c = evidenceCounts.labor || 0;
    reasons.push(c > 0 ? `${c} labor/workplace safety issue${c !== 1 ? "s" : ""} on record` : "Below-average labor practices record");
  }
  if (s.score_environment != null && s.score_environment < 45) {
    const c = evidenceCounts.environment || 0;
    reasons.push(c > 0 ? `${c} environmental compliance issue${c !== 1 ? "s" : ""} flagged` : "Environmental record needs improvement");
  }
  if (s.score_politics != null && s.score_politics < 45) {
    reasons.push("Significant political lobbying or donation exposure");
  }
  if (s.score_social != null && s.score_social < 45) {
    reasons.push("Social responsibility concerns identified");
  }
  if (parentName && parentName !== brandName) {
    reasons.push(`Owned by ${parentName} — a large parent company`);
  }
  if (reasons.length === 0 && s.overall != null) {
    if (s.overall >= 65) reasons.push("No major issues found in checked sources");
    else reasons.push("Mixed record across multiple categories");
  }
  return reasons.slice(0, 3);
}

function getLetterGrade(score: number | null): string {
  if (score === null) return "—";
  if (score >= 85) return "A";
  if (score >= 75) return "B+";
  if (score >= 65) return "B";
  if (score >= 55) return "B-";
  if (score >= 45) return "C";
  if (score >= 35) return "C-";
  if (score >= 25) return "D";
  return "F";
}

function getDimensionSummary(key: string, score: number | null, count: number): string {
  if (score === null) return "Not enough data yet";
  if (key === "labor") {
    if (score >= 65) return "No verified negative signal found in reviewed sources";
    return count > 0 ? `${count} OSHA-linked incident${count !== 1 ? "s" : ""} and workplace safety concerns` : "Below-average labor practices";
  }
  if (key === "environment") {
    if (score >= 65) return "No reportable issues found in reviewed sources";
    return count > 0 ? `${count} EPA-linked compliance issue${count !== 1 ? "s" : ""}` : "Environmental record needs improvement";
  }
  if (key === "politics") {
    if (score >= 65) return "Limited political spending detected";
    return "Political lobbying and donation exposure identified";
  }
  if (score >= 65) return "No major concerns identified";
  return "Social responsibility concerns found";
}

// ─── Main component ───
export default function ScanResultV1() {
  const { barcode } = useParams<{ barcode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { product?: any; brand?: any; source?: string } | null;
  const [showCorrection, setShowCorrection] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!barcode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">No barcode provided</h2>
            <p className="text-sm text-muted-foreground">Please scan a product barcode to see results.</p>
            <Button onClick={() => navigate("/scan")} className="w-full">Scan a Product</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normalize barcode: pad 12-digit UPC-A to 13-digit EAN-13
  const normalizedBarcode = barcode && /^\d{12}$/.test(barcode) ? '0' + barcode : barcode;

  // Use navigation state as seed data to avoid re-query gaps
  const navProduct = navState?.product ? {
    id: navState.product.id,
    barcode: navState.product.barcode,
    name: navState.product.name,
    brand_id: navState.product.brand_id,
    category: navState.product.category,
  } : null;

  const navBrandName = navState?.brand?.name || navState?.product?.brands?.name || null;

  // ─── Smart product lookup (internal DB → OpenFoodFacts → UPCitemdb) ───
  const { data: product, isLoading: productLoading, error: productError } = useQuery({
    queryKey: ["product-v1", normalizedBarcode],
    initialData: navProduct || undefined,
    queryFn: async () => {
      // First try internal DB (fast path) — try both normalized and original
      const barcodesToTry = normalizedBarcode !== barcode ? [normalizedBarcode!, barcode!] : [barcode!];
      
      for (const bc of barcodesToTry) {
        const { data: cached } = await supabase
          .from("products")
          .select("id, barcode, name, brand_id, category")
          .eq("barcode", bc)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cached) return cached;
      }
      

      // Fallback: call smart-product-lookup (OpenFoodFacts + UPCitemdb)
      console.log(`[ScanResult] No local product for ${normalizedBarcode}, calling smart-product-lookup`);
      const { data: lookupResult, error: lookupError } = await supabase.functions.invoke(
        "smart-product-lookup",
        { body: { barcode: normalizedBarcode } }
      );

      if (lookupError) {
        console.error("[ScanResult] smart-product-lookup error:", lookupError);
        throw lookupError;
      }

      // If the API found the product, it's now cached in DB
      if (lookupResult?.product) {
        return {
          id: lookupResult.product.id,
          barcode: lookupResult.product.barcode,
          name: lookupResult.product.name,
          brand_id: lookupResult.product.brand_id,
          category: lookupResult.product.category,
        };
      }

      // Not found anywhere
      return null;
    },
    enabled: !!barcode,
  });

  const { data: brandInfo, isLoading: brandLoading, refetch: refetchBrand } = useQuery({
    queryKey: ["brand-info-v1", product?.brand_id],
    enabled: !!product?.brand_id,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      return status === "stub" || status === "building" ? 5000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands" as any)
        .select("id, name, slug, status, logo_url, description, enrichment_stage, enrichment_stage_updated_at, enrichment_started_at, parent_company_id, parent_company, website")
        .eq("id", product!.brand_id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        id: string;
        name: string;
        slug: string | null;
        status: string | null;
        logo_url: string | null;
        description: string | null;
        enrichment_stage: string | null;
        enrichment_stage_updated_at: string | null;
        enrichment_started_at: string | null;
        parent_company_id: string | null;
        parent_company: string | null;
        website: string | null;
      } | null;
    },
  });

  // Score data — fetch all dimension columns, not just `score`
  const { data: scoreData } = useQuery({
    queryKey: ["scan-score", brandInfo?.id],
    enabled: !!brandInfo?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_scores")
        .select("score, score_labor, score_environment, score_politics, score_social")
        .eq("brand_id", brandInfo!.id)
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        overall: data.score ?? null,
        score_labor: data.score_labor ?? null,
        score_environment: data.score_environment ?? null,
        score_politics: data.score_politics ?? null,
        score_social: data.score_social ?? null,
      };
    },
  });

  // Evidence counts by category
  const { data: evidenceCounts } = useQuery({
    queryKey: ["scan-evidence-counts", brandInfo?.id],
    enabled: !!brandInfo?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_events")
        .select("category")
        .eq("brand_id", brandInfo!.id)
        .eq("is_irrelevant", false);
      if (error || !data) return { labor: 0, environment: 0, politics: 0, social: 0, total: 0 };
      const counts: Record<string, number> = { labor: 0, environment: 0, politics: 0, social: 0, total: data.length };
      data.forEach((e: any) => {
        if (e.category && counts[e.category] !== undefined) counts[e.category]++;
      });
      return counts;
    },
  });

  // Display profile — canonical enriched data layer
  const { data: displayProfile } = useDisplayProfile(product?.brand_id);

  // Use navigation state brand name as fallback display name
  // Priority: display profile > formatted raw name > nav state
  const displayBrandName = displayProfile?.display_name || formatBrandName(brandInfo?.name || navBrandName) || null;
  const displayProductName = formatProductName(product?.name) || product?.name || "Product";
  const displayCategory = displayProfile?.category_label || formatCategory(product?.category);
  const displayParent = displayProfile?.parent_display_name || (brandInfo?.parent_company ? formatBrandName(brandInfo.parent_company) : null);

  // States
  const brandIsReady = brandInfo?.status === "ready" || brandInfo?.status === "active";
  const brandIsBuilding = brandInfo?.status === "stub" || brandInfo?.status === "building";
  const brandIsFailed = brandInfo?.status === "failed";
  const brandExists = Boolean(brandInfo?.id);

  const overallScore = scoreData?.overall ?? null;
  const counts = evidenceCounts || { labor: 0, environment: 0, politics: 0, social: 0, total: 0 };

  // Detect near-baseline scores: all dimensions within ±3 of 50 with minimal evidence
  // This catches both flat-50 baselines AND weakly-differentiated scores (47-53)
  // that result from low-impact events providing no meaningful signal
  const isNearBaseline = scoreData && (
    (scoreData.overall === null || (scoreData.overall >= 47 && scoreData.overall <= 53)) &&
    (scoreData.score_labor === null || (scoreData.score_labor >= 47 && scoreData.score_labor <= 53)) &&
    (scoreData.score_environment === null || (scoreData.score_environment >= 47 && scoreData.score_environment <= 53)) &&
    (scoreData.score_politics === null || (scoreData.score_politics >= 47 && scoreData.score_politics <= 53)) &&
    (scoreData.score_social === null || (scoreData.score_social >= 47 && scoreData.score_social <= 53))
  );
  // MINIMUM SIGNAL THRESHOLD: suppress verdict if fewer than 5 direct events
  // regardless of score value — a single event shouldn't drive a verdict
  const hasMinimalEvidence = (counts.total || 0) < 5;
  const isBaselineScore = isNearBaseline && hasMinimalEvidence;
  // Also suppress any score backed by < 5 events even if outside baseline range
  const isInsufficientEvidence = hasMinimalEvidence && !isNearBaseline;

  const effectiveScore = (isBaselineScore || isInsufficientEvidence) ? null : overallScore;
  const effectiveLabor = (isBaselineScore || isInsufficientEvidence) ? null : (scoreData?.score_labor ?? null);
  const effectiveEnv = (isBaselineScore || isInsufficientEvidence) ? null : (scoreData?.score_environment ?? null);
  const effectivePol = (isBaselineScore || isInsufficientEvidence) ? null : (scoreData?.score_politics ?? null);
  const effectiveSoc = (isBaselineScore || isInsufficientEvidence) ? null : (scoreData?.score_social ?? null);

  const dimensions = [
    { key: "labor", label: "Labor & Safety", score: effectiveLabor, evidenceCount: counts.labor, summary: getDimensionSummary("labor", effectiveLabor, counts.labor) },
    { key: "environment", label: "Environment", score: effectiveEnv, evidenceCount: counts.environment, summary: getDimensionSummary("environment", effectiveEnv, counts.environment) },
    { key: "politics", label: "Political Influence", score: effectivePol, evidenceCount: counts.politics, summary: getDimensionSummary("politics", effectivePol, counts.politics) },
    { key: "social", label: "Social Impact", score: effectiveSoc, evidenceCount: counts.social, summary: getDimensionSummary("social", effectiveSoc, counts.social) },
  ];

  const reasons = buildReasons(scoreData, counts, brandInfo?.parent_company, brandInfo?.name);

  const verdictLabel = effectiveScore === null ? "Checking..." : effectiveScore >= 65 ? "Good" : effectiveScore >= 40 ? "Mixed" : "Avoid";

  // Logo
  const displayLogo = useBrandLogo(brandInfo?.logo_url || null, brandInfo?.website || null);

  // Save scan
  const handleSaveScan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ title: "Sign in to save scans" }); return; }
    try {
      await supabase.from("user_scans").upsert({
        user_id: user.id,
        barcode,
        product_id: product?.id,
        brand_id: product?.brand_id,
        scanned_at: new Date().toISOString(),
      }, { onConflict: "user_id,barcode" });
      setSaved(true);
      toast({ title: "Scan saved!", description: "Added to your scan history." });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  // Correction submit
  const handleCorrection = async (data: { name?: string; website?: string }) => {
    if (!brandInfo?.id) return;
    try {
      const updates: Record<string, any> = {};
      if (data.name) updates.name = data.name;
      if (data.website) {
        updates.website = data.website.startsWith("http") ? data.website : `https://${data.website}`;
        updates.canonical_domain = data.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("brands").update(updates).eq("id", brandInfo.id);
        toast({ title: "Thanks!", description: "Your correction has been submitted." });
        setShowCorrection(false);
        refetchBrand();
      }
    } catch {
      toast({ title: "Failed to submit", variant: "destructive" });
    }
  };

  // ─── Loading ───
  if (productLoading) {
    return (
      <div className="min-h-screen bg-background">
        <ScanHeader onBack={() => navigate(-1)} />
        <main className="container max-w-md mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </main>
      </div>
    );
  }

  if (product?.brand_id && brandLoading) {
    return (
      <div className="min-h-screen bg-background">
        <ScanHeader onBack={() => navigate(-1)} />
        <main className="container max-w-md mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </main>
      </div>
    );
  }

  // ─── Not found → redirect to Add Product ───
  // Only redirect if we genuinely have no product data from any source
  if (!productLoading && (productError || !product) && !navProduct && !navBrandName) {
    navigate(`/unknown/${barcode}`, { replace: true });
    return null;
  }

  // If we have nav state (from history) but DB lookup failed, show what we have
  // instead of immediately redirecting to unknown
  if (!productLoading && !product && (navProduct || navBrandName)) {
    // The product may have been removed from DB but we still have cached info
    // Show a minimal result with the cached brand name
    return (
      <div className="min-h-screen bg-background">
        <ScanHeader onBack={() => navigate(-1)} />
        <main className="container max-w-md mx-auto px-4 py-6 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground" />
              <h2 className="text-lg font-semibold">{navProduct?.name || "Product"}</h2>
              {navBrandName && <p className="text-sm text-muted-foreground">by {navBrandName}</p>}
              <p className="text-xs text-muted-foreground">This product's data is being refreshed. Try scanning again.</p>
              <Button onClick={() => navigate("/scan")} className="w-full mt-2">Scan Again</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ─── Building state ───
  if (brandIsBuilding || brandIsFailed) {
    return (
      <div className="min-h-screen bg-background">
        <ScanHeader onBack={() => navigate(-1)} />
        <main className="container max-w-md mx-auto px-4 py-6 space-y-4">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-warning/20 flex items-center justify-center flex-shrink-0">
                  {brandIsFailed ? <AlertCircle className="h-6 w-6 text-warning" /> : <Loader2 className="h-6 w-6 text-warning animate-spin" />}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{brandIsFailed ? "Profile needs review" : "Building this profile"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {brandIsFailed ? "Verifying identity — usually takes a few minutes" : "ETA ~30 seconds — this page updates automatically"}
                  </p>
                </div>
              </div>
              <EnrichmentStageProgress
                stage={brandInfo?.enrichment_stage as any}
                stageUpdatedAt={brandInfo?.enrichment_stage_updated_at}
                startedAt={brandInfo?.enrichment_started_at}
                status={brandInfo?.status || "stub"}
                brandName={brandInfo?.name}
              />
              <div className="pt-2 border-t space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="font-medium">{product.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Brand</p>
                  <p className="font-medium">{displayBrandName || "Resolving..."}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleSaveScan} disabled={saved}>
                {saved ? <><Check className="h-4 w-4 mr-2" />Saved</> : <><Save className="h-4 w-4 mr-2" />Save to My Scans</>}
              </Button>
              {!showCorrection ? (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowCorrection(true)}>
                  Help improve this brand's data
                </Button>
              ) : (
                <CorrectionForm brandName={brandInfo?.name || ""} onSubmit={handleCorrection} />
              )}
            </CardContent>
          </Card>
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => brandInfo?.slug && navigate(`/brand/${brandInfo.slug}`, { state: { scannedBrandId: brandInfo?.id, scannedBrandName: displayBrandName || brandInfo?.name } })}>
              <ExternalLink className="h-4 w-4 mr-2" />View Profile Anyway
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/scan")}>Scan Another Product</Button>
          </div>
        </main>
      </div>
    );
  }

  // Detect if this is effectively an unknown/unrated brand
  const isUnknownBrand = !product?.brand_id || (!brandLoading && !displayBrandName) || displayBrandName === "Unknown Brand" || displayBrandName === "Unknown";
  const isUnrated = effectiveScore === null;
  const isDeadEnd = !brandLoading && isUnknownBrand && isUnrated && !navBrandName;

  // ═══════════════════════════════════════════════════
  // DEAD END STATE — Unknown brand, no scores
  // Turn failure into contribution opportunity
  // ═══════════════════════════════════════════════════
  if (isDeadEnd) {
    // Skip dead-end screen entirely — go straight to Add Product
    navigate(`/unknown/${barcode}`, { replace: true });
    return null;
  }

  // ═══════════════════════════════════════════════════
  // READY STATE — The Yuka-inspired decision screen
  // ═══════════════════════════════════════════════════
  return (
      <div className="min-h-screen bg-background">
      <ScanHeader onBack={() => navigate(-1)} />

      <main className="container max-w-md mx-auto px-4 py-5 space-y-4">
        {/* ═══ PRODUCT LAYER — What you scanned ═══ */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-primary font-medium uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Package className="h-3 w-3" />
              You scanned this
            </p>
            <div className="flex items-center gap-3">
              {/* Use display profile logo, then useBrandLogo fallback */}
              {(displayProfile?.logo_url || displayLogo) ? (
                <img src={displayProfile?.logo_url || displayLogo!} alt={displayBrandName || ""} className="w-14 h-14 border-2 border-border object-contain bg-background flex-shrink-0 p-1.5 rounded" />
              ) : (
                <div className="w-14 h-14 border-2 border-border grid place-items-center text-xl font-bold bg-background flex-shrink-0 rounded">
                  {displayBrandName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold tracking-tight leading-tight">{displayProductName}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  by <span className="font-medium text-foreground">{displayBrandName || "Resolving..."}</span>
                </p>
                {displayCategory && (
                  <p className="text-xs text-muted-foreground mt-1">{displayCategory}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ RATING ═══ */}
        <div className="pt-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Search className="h-3 w-3" />
            Who makes this?
          </p>
        </div>

        {/* ─── 1. INSTANT VERDICT ─── */}
        <TrustVerdict
          score={effectiveScore}
          brandName={displayBrandName || ""}
          reasons={(isBaselineScore || isInsufficientEvidence) ? ["Limited data — score requires at least 5 verified events"] : reasons}
          hasEvidence={(counts.total || 0) > 0}
          category={displayCategory || product?.category}
          parentCompany={displayParent || brandInfo?.parent_company}
          website={brandInfo?.website}
          profileSummary={displayProfile?.summary}
          profileCompleteness={displayProfile?.profile_completeness}
          eventCount={counts.total || 0}
        />

        {/* ─── 2. OWNERSHIP ─── */}
        {brandInfo?.id && (
          <OwnershipReveal brandId={brandInfo.id} brandName={displayBrandName || brandInfo.name} parentCompany={displayParent || brandInfo.parent_company} />
        )}

        {/* ─── 3. BETTER ALTERNATIVES ─── */}
        {brandInfo?.id && (
          <AlternativesSection brandId={brandInfo.id} brandName={displayBrandName || brandInfo.name || "this brand"} />
        )}

        {/* ─── 4. DETAILED BREAKDOWN (collapsible) ─── */}
        {brandInfo?.id && (
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer p-4 bg-elevated-1 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              See detailed breakdown
              <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-2">
              <ScoreBreakdownCard brandId={brandInfo.id} dimensions={dimensions} />
            </div>
          </details>
        )}

        {/* ─── 5. SHARE ─── */}
        <ShareCard
          brandName={displayBrandName || brandInfo?.name || ""}
          score={effectiveScore}
          verdict={verdictLabel}
          dimensions={dimensions.map((d) => ({ label: d.label, grade: getLetterGrade(d.score) }))}
        />

        {/* Actions */}
        <div className="space-y-2">
          {brandInfo?.slug && (
            <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => navigate(`/brand/${brandInfo.slug}`, { state: { scannedBrandId: brandInfo.id, scannedBrandName: displayBrandName || brandInfo.name } })}>
              More about this company →
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => navigate("/scan")}>Scan Another Product</Button>
        </div>

        {/* Beta */}
        <p className="text-xs text-center text-muted-foreground px-4 pb-4">
          Based on verified public records. Coverage expands weekly.
        </p>
      </main>
    </div>
  );
}

// ─── Shared header ───
function ScanHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
      <div className="container max-w-md mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Scan Result</h1>
        </div>
      </div>
    </header>
  );
}
