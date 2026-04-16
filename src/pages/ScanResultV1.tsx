import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Package, AlertCircle, Loader2, Check, Save, ExternalLink, Search, Users, TrendingUp, HelpCircle, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AlternativesSection } from "@/components/brand/AlternativesSection";
import { CommunityOutlookCard } from "@/components/brand/CommunityOutlookCard";
import { RateBrandModal } from "@/components/brand/RateBrandModal";

import { EvidenceSection } from "@/components/scan/EvidenceSection";
import { TrustVerdict } from "@/components/scan/TrustVerdict";
import { ReasonProofList } from "@/components/brand/ReasonProofList";
import { ScoreBreakdownCard } from "@/components/scan/ScoreBreakdownCard";
import { formatCategory } from "@/lib/formatCategory";
import { formatBrandName, formatProductName } from "@/lib/formatBrandName";
import { OwnershipReveal } from "@/components/scan/OwnershipReveal";
import { ShareCard, getGrade } from "@/components/scan/ShareCard";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { useDisplayProfile } from "@/hooks/useDisplayProfile";
import { usePersonalizedBrandScore } from "@/hooks/usePersonalizedBrandScore";

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

// ─── Score reason generator (shared) ───
import { buildReasons } from "@/lib/buildReasons";

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
  const [showRateModal, setShowRateModal] = useState(false);

  // Auth state for personalization
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? undefined));
  }, []);

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

  // Cap polling at 60s to prevent infinite loops on stuck "building" brands
  const pollStartRef = useRef<number>(Date.now());
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const MAX_POLL_MS = 60_000;

  const { data: brandInfo, isLoading: brandLoading, refetch: refetchBrand } = useQuery({
    queryKey: ["brand-info-v1", product?.brand_id],
    enabled: !!product?.brand_id,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      const isBuilding = status === "stub" || status === "building";
      if (!isBuilding) return false;
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed >= MAX_POLL_MS) {
        if (!pollTimedOut) setPollTimedOut(true);
        return false;
      }
      return 5000;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands" as any)
        .select("id, name, slug, status, logo_url, description, enrichment_stage, enrichment_stage_updated_at, enrichment_started_at, parent_company, website")
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

  // Personalized scoring — overlays raw scores when user is logged in with preferences
  const { data: personalizedResult } = usePersonalizedBrandScore(brandInfo?.id, currentUserId);
  const isPersonalized = !!personalizedResult && !!currentUserId;

  // States
  const brandIsReady = brandInfo?.status === "ready" || brandInfo?.status === "active";
  const brandIsBuilding = brandInfo?.status === "stub" || brandInfo?.status === "building";
  const brandIsFailed = brandInfo?.status === "failed";
  const brandExists = Boolean(brandInfo?.id);

  const overallScore = isPersonalized ? personalizedResult.personalScore : (scoreData?.overall ?? null);
  const counts = evidenceCounts || { labor: 0, environment: 0, politics: 0, social: 0, total: 0 };

  // Detect near-baseline scores: all dimensions within ±3 of 50 with minimal evidence
  const isNearBaseline = scoreData && (
    (scoreData.overall === null || (scoreData.overall >= 47 && scoreData.overall <= 53)) &&
    (scoreData.score_labor === null || (scoreData.score_labor >= 47 && scoreData.score_labor <= 53)) &&
    (scoreData.score_environment === null || (scoreData.score_environment >= 47 && scoreData.score_environment <= 53)) &&
    (scoreData.score_politics === null || (scoreData.score_politics >= 47 && scoreData.score_politics <= 53)) &&
    (scoreData.score_social === null || (scoreData.score_social >= 47 && scoreData.score_social <= 53))
  );
  const hasMinimalEvidence = (counts.total || 0) < 5;
  const isBaselineScore = isNearBaseline && hasMinimalEvidence;
  const isInsufficientEvidence = hasMinimalEvidence && !isNearBaseline;

  // When personalized, use personalized category scores; otherwise use raw DB scores
  // Only suppress if baseline AND no evidence at all
  const suppressScore = isBaselineScore && !((counts.total || 0) > 0);
  const effectiveScore = suppressScore ? null : overallScore;

  const effectiveLabor = suppressScore ? null : (isPersonalized ? Math.round(personalizedResult.categoryScores.labor * 10 + 50) : (scoreData?.score_labor ?? null));
  const effectiveEnv = suppressScore ? null : (isPersonalized ? Math.round(personalizedResult.categoryScores.environment * 10 + 50) : (scoreData?.score_environment ?? null));
  const effectivePol = suppressScore ? null : (isPersonalized ? Math.round(personalizedResult.categoryScores.politics * 10 + 50) : (scoreData?.score_politics ?? null));
  const effectiveSoc = suppressScore ? null : (isPersonalized ? Math.round(personalizedResult.categoryScores.social * 10 + 50) : (scoreData?.score_social ?? null));

  const dimensions = [
    { key: "labor", label: "Labor & Safety", score: effectiveLabor, evidenceCount: counts.labor, summary: getDimensionSummary("labor", effectiveLabor, counts.labor) },
    { key: "environment", label: "Environment", score: effectiveEnv, evidenceCount: counts.environment, summary: getDimensionSummary("environment", effectiveEnv, counts.environment) },
    { key: "politics", label: "Political Influence", score: effectivePol, evidenceCount: counts.politics, summary: getDimensionSummary("politics", effectivePol, counts.politics) },
    { key: "social", label: "Social Impact", score: effectiveSoc, evidenceCount: counts.social, summary: getDimensionSummary("social", effectiveSoc, counts.social) },
  ];

  const reasons = isPersonalized && !suppressScore
    ? personalizedResult.contributions
        .filter(c => Math.abs(c.contribution) > 0.05)
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, 3)
        .map(c => {
          const label = c.category === 'labor' ? 'Labor' : c.category === 'environment' ? 'Environment' : c.category === 'politics' ? 'Politics' : 'Social';
          const dir = c.isPositive ? 'positive' : 'negative';
          return `${label}: ${dir} impact (weight: ${Math.round(c.weight * 100)}%)`;
        })
    : buildReasons({ scores: { score_labor: scoreData?.score_labor, score_environment: scoreData?.score_environment, score_politics: scoreData?.score_politics, score_social: scoreData?.score_social, overall: scoreData?.overall }, evidenceCounts: counts, parentName: brandInfo?.parent_company, brandName: brandInfo?.name });

  // Fallback if personalized reasons are empty
  const effectiveReasons = reasons.length > 0 ? reasons : buildReasons({ scores: { score_labor: scoreData?.score_labor, score_environment: scoreData?.score_environment, score_politics: scoreData?.score_politics, score_social: scoreData?.score_social, overall: scoreData?.overall }, evidenceCounts: counts, parentName: brandInfo?.parent_company, brandName: brandInfo?.name });

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

  // Correction submit — routes to moderation queue, never writes brands directly
  const handleCorrection = async (data: { name?: string; website?: string }) => {
    if (!brandInfo?.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in to submit corrections", description: "We use this to track quality of community input." });
      return;
    }
    try {
      const proposedWebsite = data.website
        ? (data.website.startsWith("http") ? data.website : `https://${data.website}`)
        : null;
      const proposed_changes: Record<string, any> = {};
      if (data.name) proposed_changes.name = data.name;
      if (proposedWebsite) proposed_changes.website = proposedWebsite;
      if (Object.keys(proposed_changes).length === 0) return;

      const { error } = await supabase.from("brand_corrections").insert({
        brand_id: brandInfo.id,
        proposed_name: data.name ?? null,
        proposed_website: proposedWebsite,
        proposed_changes,
        submitter_user_id: user.id,
      });
      if (error) throw error;
      toast({
        title: "Thanks — we'll review this",
        description: "Your suggestion was submitted. We'll update the brand if verified.",
      });
      setShowCorrection(false);
    } catch (e: any) {
      console.error("[ScanResult] correction submit failed:", e);
      toast({ title: "Failed to submit", description: e?.message, variant: "destructive" });
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
  // If we have no score at all and brand is building, still fall through
  // to ready state — TrustVerdict and ReasonProofList handle null scores gracefully
  const isPreliminary = brandIsBuilding || brandIsFailed;

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

        {/* ═══ BLOCK 1: VERDICT (dominant) ═══ */}
        {isPreliminary && effectiveScore !== null && (
          <div className="text-xs text-muted-foreground text-center">Preliminary · based on available data</div>
        )}

        <TrustVerdict
          score={effectiveScore}
          brandName={displayBrandName || ""}
          reasons={(isBaselineScore || isInsufficientEvidence) ? ["Limited data — score requires at least 5 verified events"] : effectiveReasons}
          hasEvidence={(counts.total || 0) > 0}
          category={displayCategory || product?.category}
          parentCompany={displayParent || brandInfo?.parent_company}
          website={brandInfo?.website}
          profileSummary={displayProfile?.summary}
          profileCompleteness={displayProfile?.profile_completeness}
          eventCount={counts.total || 0}
        />

        {/* ═══ BLOCK 2: REASONS WITH PROOF ═══ */}
        {brandInfo?.id && (
          <ReasonProofList
            brandId={brandInfo.id}
            brandName={displayBrandName || brandInfo.name}
            parentName={displayParent || brandInfo.parent_company}
            scores={{
              score_labor: effectiveLabor,
              score_environment: effectiveEnv,
              score_politics: effectivePol,
              score_social: effectiveSoc,
              overall: effectiveScore,
            }}
          />
        )}

        {/* ═══ BLOCK 3: BETTER ALTERNATIVES ═══ */}
        {brandInfo?.id && (
          <AlternativesSection brandId={brandInfo.id} brandName={displayBrandName || brandInfo.name || "this brand"} />
        )}

        {/* ═══ BLOCK 4: SCAN ANOTHER ═══ */}
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => navigate("/scan")}>Scan Another Product</Button>
          {brandInfo?.slug && (
            <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => navigate(`/brand/${brandInfo.slug}`, { state: { scannedBrandId: brandInfo.id, scannedBrandName: displayBrandName || brandInfo.name } })}>
              More about this company →
            </Button>
          )}
        </div>

        {/* ═══ COLLAPSED: See proof & details ═══ */}
        {brandInfo?.id && (
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer p-4 bg-elevated-1 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              See proof & details
              <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-3 space-y-4">
              <OwnershipReveal brandId={brandInfo.id} brandName={displayBrandName || brandInfo.name} parentCompany={displayParent || brandInfo.parent_company} />
              <EvidenceSection brandId={brandInfo.id} brandName={displayBrandName || brandInfo.name} />
              <ScoreBreakdownCard brandId={brandInfo.id} dimensions={dimensions} />
              <CommunityOutlookCard brandId={brandInfo.id} brandName={displayBrandName || brandInfo.name || "This brand"} />
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setShowRateModal(true)}>Rate this brand</Button>
              </div>
              <RateBrandModal open={showRateModal} onOpenChange={setShowRateModal} brandId={brandInfo.id} brandName={displayBrandName || brandInfo.name || "This brand"} />
              <ShareCard
                brandName={displayBrandName || brandInfo?.name || ""}
                score={effectiveScore}
                verdict={verdictLabel}
                dimensions={dimensions.map((d) => ({ label: d.label, grade: getLetterGrade(d.score) }))}
              />
            </div>
          </details>
        )}

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
