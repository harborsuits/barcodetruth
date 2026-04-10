import { useEffect, useState } from 'react';
import { useDisplayProfile } from '@/hooks/useDisplayProfile';
import { isBaselineScore } from '@/lib/isBaselineScore';
import { AlternativesSection } from '@/components/brand/AlternativesSection';
import { CommunityOutlookCard } from '@/components/brand/CommunityOutlookCard';
import { RateBrandModal } from '@/components/brand/RateBrandModal';
import { CorporateFamilyTree } from '@/components/brand/CorporateFamilyTree';
import { ScoreTransparency } from '@/components/brand/ScoreTransparency';
import { ConfidenceBadge } from '@/components/brand/ConfidenceBadge';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ExternalLink, AlertCircle, Building2, Loader2, ShieldCheck, Clock, Network } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BrandIdentityHeader } from '@/components/brand/BrandIdentityHeader';
import { useAutoEnrichment } from '@/hooks/useAutoEnrichment';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import { isUUID } from '@/lib/utils';
import { useProfileState } from '@/hooks/useProfileState';
import { BuildingProfile } from '@/components/brand/BuildingProfile';
import { NeedsReviewProfile } from '@/components/brand/NeedsReviewProfile';
import { deduplicateEvents } from '@/lib/deduplicateEvents';
import { bt } from '@/lib/behaviorTracker';
import { ReasonProofList } from '@/components/brand/ReasonProofList';

// V1 Consumer Contract - with 3 explicit states:
// State A: Assessable (full profile) - identity verified + 3+ dimensions with evidence
// State B: Building (in progress) - gathering evidence, show progress
// State C: Needs Review (mismatch) - identity confidence low or name mismatch detected

// EnrichmentProgress removed — no pipeline UI exposed to users

function ScoreDisplay({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-sm font-medium text-muted-foreground">Limited Data</p>
        <p className="text-xs text-muted-foreground mt-1">
          Not enough verified records to generate a score yet.
        </p>
      </div>
    );
  }
  
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'text-success';
    if (s >= 40) return 'text-warning';
    return 'text-destructive';
  };
  
  const getScoreLabel = (s: number) => {
    if (s >= 70) return 'Low risk';
    if (s >= 40) return 'Mixed record';
    return 'High exposure';
  };
  
  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
      <div>
        <p className="text-sm text-muted-foreground">Overall Score</p>
        <p className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {Math.round(score)}/100
        </p>
      </div>
      <div className={`text-lg font-semibold ${getScoreColor(score)}`}>
        {getScoreLabel(score)}
      </div>
    </div>
  );
}

function OwnershipDisplay({ brandId, brandSlug, scannedBrandId, scannedBrandName }: { brandId: string; brandSlug?: string; scannedBrandId?: string; scannedBrandName?: string }) {
  const navigate = useNavigate();
  const { data: ownership, isLoading } = useQuery({
    queryKey: ['brand-ownership-v1', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_brand_ownership' as any, {
        p_brand_id: brandId
      });
      if (error) {
        console.error('Ownership query error:', error);
        return null;
      }
      return data;
    },
    enabled: !!brandId,
  });
  
  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }
  
  const chain = (ownership as any)?.structure?.chain || [];
  const selfEntity = chain.length > 0 ? chain[0] : null;
  const parentCompany = chain.length > 1 ? chain[chain.length - 1] : null;
  const isPublicCompany = selfEntity?.is_public === true;
  const slug = brandSlug || brandId;
  
  // Case 1: Has a parent company above it
  if (parentCompany) {
    return (
      <div
        className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors active:scale-[0.98]"
        onClick={() => navigate(`/brand/${slug}/ownership`, { state: { scannedBrandId, scannedBrandName } })}
        role="button"
      >
        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Corporate Owner</p>
          <p className="font-semibold">{parentCompany.name}</p>
        </div>
        <Network className="h-4 w-4 text-primary flex-shrink-0" />
      </div>
    );
  }
  
  // Case 2: This IS a public parent company (no parent above it)
  if (isPublicCompany && selfEntity) {
    return (
      <div
        className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => navigate(`/brand/${slug}/ownership`, { state: { scannedBrandId, scannedBrandName } })}
        role="button"
      >
        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Public Company</p>
          <p className="text-xs text-muted-foreground">
            {selfEntity.name} is publicly traded — no parent corporation
          </p>
        </div>
        <Network className="h-4 w-4 text-primary flex-shrink-0" />
      </div>
    );
  }
  
  // Case 3: No ownership data - be honest about it
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div>
        <p className="font-medium text-muted-foreground">Ownership: Not verified yet</p>
        <p className="text-xs text-muted-foreground">We're still gathering ownership data for this brand</p>
      </div>
    </div>
  );
}

function EvidenceList({ brandId }: { brandId: string }) {
  const navigate = useNavigate();
  
  const { data: evidence, isLoading } = useQuery({
    queryKey: ['brand-evidence-v1', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_events')
        .select('event_id, title, event_date, category, source_url')
        .eq('brand_id', brandId)
        .eq('is_irrelevant', false)
        .order('event_date', { ascending: false })
        .limit(20);
      
      if (error) return [];
      return deduplicateEvents(data || []);
    },
    enabled: !!brandId,
  });
  
  const { data: totalCount } = useQuery({
    queryKey: ['brand-evidence-count', brandId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('brand_events')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('is_irrelevant', false);
      
      if (error) return 0;
      return count || 0;
    },
    enabled: !!brandId,
  });
  
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  
  if (!evidence || evidence.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">No verified evidence items yet.</p>
      </div>
    );
  }
  
  const displayedEvidence = evidence.slice(0, 5);

  // Extract domain from URL for source badge
  const getSourceName = (url?: string) => {
    if (!url) return null;
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      const parts = hostname.split('.');
      return parts[0].toUpperCase();
    } catch {
      return null;
    }
  };
  
  return (
    <div className="divide-y divide-border">
      {displayedEvidence.map((ev) => {
        const hasUrl = !!ev.source_url;
        const sourceName = getSourceName(ev.source_url);
        
        const inner = (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {sourceName && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5">
                  {sourceName}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground font-mono">
                {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {ev.duplicates && ev.duplicates.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  +{ev.duplicates.length} outlets
                </span>
              )}
            </div>
            <p className="text-sm font-medium leading-snug">{ev.title}</p>
            {hasUrl && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                Source <ExternalLink className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        );

        if (hasUrl) {
          return (
            <a 
              key={ev.event_id} 
              href={ev.source_url!} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:bg-elevated-2 transition-colors"
            >
              {inner}
            </a>
          );
        }

        return (
          <div key={ev.event_id} className="opacity-70">
            {inner}
          </div>
        );
      })}
      
      {(totalCount || 0) > 5 && (
        <div className="p-3">
          <Button 
            variant="ghost" 
            className="w-full text-xs text-muted-foreground"
            onClick={() => navigate(`/proof/${brandId}`)}
          >
            View all evidence ({totalCount} items) →
          </Button>
        </div>
      )}
    </div>
  );
}

export default function BrandProfileV1() {
  const { id, brandId } = useParams<{ id?: string; brandId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = useIsAdmin();
  const [verifying, setVerifying] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const slugOrId = id || brandId;
  const isUuidRoute = isUUID(slugOrId);
  
  const routerLocation = useLocation();
  const cameFromBrand = (routerLocation as any)?.state?.fromBrand;
  const scannedBrandId = (routerLocation as any)?.state?.scannedBrandId as string | undefined;
  const scannedBrandName = (routerLocation as any)?.state?.scannedBrandName as string | undefined;

  // Query brand info with alias fallback
  const { data: brand, isLoading: brandLoading, error: brandError } = useQuery({
    queryKey: ['brand-v1', slugOrId],
    enabled: !!slugOrId,
    queryFn: async () => {
      if (!slugOrId) return null;

      // 1) UUID route - direct ID lookup
      if (isUuidRoute) {
        const { data, error } = await supabase
          .from('brands')
          .select('*')
          .eq('id', slugOrId)
          .maybeSingle();
        if (error) throw error;
        return data;
      }

      // 2) Canonical slug lookup
      const { data: bySlug, error: slugErr } = await supabase
        .from('brands')
        .select('*')
        .eq('slug', slugOrId)
        .maybeSingle();
      if (slugErr) throw slugErr;
      if (bySlug) return bySlug;

      // 3) Alias lookup (for old slugs or common misspellings)
      const { data: aliasRow, error: aliasErr } = await supabase
        .from('brand_slug_aliases')
        .select('brand_id')
        .eq('alias', slugOrId)
        .maybeSingle();
      if (aliasErr) throw aliasErr;

      if (aliasRow?.brand_id) {
        const { data: byAliasId, error: idErr } = await supabase
          .from('brands')
          .select('*')
          .eq('id', aliasRow.brand_id)
          .maybeSingle();
        if (idErr) throw idErr;
        return byAliasId;
      }

      return null; // Not found - will trigger redirect
    }
  });

  const resolvedBrandId = brand?.id;
  const brandStatus = brand?.status;
  const needsEnrichment = brandStatus === 'stub' || brandStatus === 'building' || !brand?.description;

  // Auto-enrichment for stubs/building brands
  const enrichmentProgress = useAutoEnrichment(
    resolvedBrandId || '',
    brand?.name || '',
    needsEnrichment && !!resolvedBrandId
  );

  // Redirect UUID route to canonical slug
  useEffect(() => {
    if (isUuidRoute && brand?.slug && brand.slug !== slugOrId) {
      navigate(`/brand/${brand.slug}`, { replace: true });
    }
  }, [isUuidRoute, brand?.slug, slugOrId, navigate]);

  // Hook-safe redirect: if brand not found after loading, redirect to search
  useEffect(() => {
    if (!brandLoading && !brand && slugOrId && !brandError) {
      navigate(`/search?q=${encodeURIComponent(slugOrId)}`, { replace: true });
    }
  }, [brandLoading, brand, slugOrId, navigate, brandError]);

  // Query score
  const { data: scoreData } = useQuery({
    queryKey: ['brand-score-v1', resolvedBrandId],
    enabled: !!resolvedBrandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_scores')
        .select('score')
        .eq('brand_id', resolvedBrandId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    }
  });

  // Query profile state for state-based rendering
  const { data: profileState, isLoading: stateLoading } = useProfileState(resolvedBrandId);
  const { data: displayProfile } = useDisplayProfile(resolvedBrandId);

  // Evidence count — must be before early returns (hooks ordering)
  const { data: evidenceTotal } = useQuery({
    queryKey: ['brand-evidence-total', resolvedBrandId],
    queryFn: async () => {
      const { count } = await supabase
        .from('brand_events')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', resolvedBrandId!)
        .eq('is_irrelevant', false);
      return count || 0;
    },
    enabled: !!resolvedBrandId,
  });

  // Track profile load (must be before early returns)
  useEffect(() => {
    if (resolvedBrandId && brand?.name) {
      bt.track("profile_loaded", {
        brand_id: resolvedBrandId,
        properties: {
          brand_name: brand.name,
          company_type: (brand as any).company_type,
          status: brandStatus,
          has_score: !!scoreData,
          logo_present: !!(brand as any).logo_url,
        },
      });
    }
  }, [resolvedBrandId]);

  // Admin action: Mark identity verified (server-side enforced)
  const markIdentityVerified = async () => {
    if (!resolvedBrandId) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.rpc('admin_verify_brand_identity', {
        p_brand_id: resolvedBrandId
      });
      
      if (error) throw error;
      
      toast({
        title: 'Identity verified',
        description: 'Brand identity marked as verified. Description now visible.',
      });
      
      // Refresh brand data
      queryClient.invalidateQueries({ queryKey: ['brand-v1', slugOrId] });
      queryClient.invalidateQueries({ queryKey: ['brand-profile-state', resolvedBrandId] });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to verify identity',
        variant: 'destructive'
      });
    } finally {
      setVerifying(false);
    }
  };

  // Loading state
  if (brandLoading || stateLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  // Error state - show brief "searching" message while redirect kicks in
  if (brandError || !brand) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Searching for "{slugOrId}"...</p>
        </main>
      </div>
    );
  }

  // Determine if this is a pending/stub brand
  const isPending = brandStatus === 'stub' || brandStatus === 'building';
  const isFailed = brandStatus === 'failed';
  const fromPendingSubmission = (routerLocation as any)?.state?.pending;

  // State-based rendering: Route to appropriate profile component
  // State C: Needs Review (identity mismatch detected)
  if (profileState?.state === 'needs_review' && !isPending && !isFailed) {
    return (
      <NeedsReviewProfile 
        brand={{
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description,
          logo_url: brand.logo_url,
          website: brand.website,
          wikidata_qid: brand.wikidata_qid,
          parent_company: brand.parent_company,
          created_at: brand.created_at,
        }} 
        stateData={profileState} 
      />
    );
  }

  // State B: Building (in progress, gathering evidence)
  if (profileState?.state === 'building' && !isFailed) {
    return (
      <BuildingProfile 
        brand={{
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          description: brand.description,
          logo_url: brand.logo_url,
          website: brand.website,
          wikidata_qid: brand.wikidata_qid,
          parent_company: brand.parent_company,
          created_at: brand.created_at,
          enrichment_stage: brand.enrichment_stage,
        }} 
        stateData={profileState} 
      />
    );
  }

  // State A: Assessable (full profile) — Consumer Decision Layout

  const parsedScore = scoreData?.score ? (typeof scoreData.score === 'string' ? JSON.parse(scoreData.score) : scoreData.score) : null;
  
  // Baseline detection — suppress near-baseline scores (47-53 range with low evidence)
  // that result from weak impact data providing no meaningful differentiation
  const _rawDims = {
    overall: parsedScore?.overall ?? null,
    score_labor: parsedScore?.score_labor ?? null,
    score_environment: parsedScore?.score_environment ?? null,
    score_politics: parsedScore?.score_politics ?? null,
    score_social: parsedScore?.score_social ?? null,
  };
  const _isBaselineFlat = isBaselineScore(_rawDims);
  const _isNearBaseline = (
    (_rawDims.overall === null || (_rawDims.overall >= 47 && _rawDims.overall <= 53)) &&
    (_rawDims.score_labor === null || (_rawDims.score_labor >= 47 && _rawDims.score_labor <= 53)) &&
    (_rawDims.score_environment === null || (_rawDims.score_environment >= 47 && _rawDims.score_environment <= 53)) &&
    (_rawDims.score_politics === null || (_rawDims.score_politics >= 47 && _rawDims.score_politics <= 53)) &&
    (_rawDims.score_social === null || (_rawDims.score_social >= 47 && _rawDims.score_social <= 53))
  );
  const _hasMinimalEvidence = (evidenceTotal || 0) < 5;
  const _isBaseline = _isBaselineFlat || (_isNearBaseline && _hasMinimalEvidence);
  
  const scoreValue = _isBaseline ? null : (parsedScore?.overall != null ? Math.round(parsedScore.overall) : null);
  
  // Dimension scores for breakdown
  const dimScores = {
    labor: _isBaseline ? null : (parsedScore?.score_labor ?? null),
    environment: _isBaseline ? null : (parsedScore?.score_environment ?? null),
    politics: _isBaseline ? null : (parsedScore?.score_politics ?? null),
    social: _isBaseline ? null : (parsedScore?.score_social ?? null),
  };

  // Verdict — use evidence count from hook above
  const hasEvidence = (evidenceTotal || 0) > 0;
  const getVerdict = (s: number | null) => {
    if (s === null) return { label: hasEvidence ? 'Limited Data' : 'Not yet rated', color: 'bg-muted text-muted-foreground', emoji: '—' };
    if (s >= 65) return { label: 'Good', color: 'bg-success/15 text-success', emoji: '🟢' };
    if (s >= 40) return { label: 'Mixed', color: 'bg-warning/15 text-warning', emoji: '🟡' };
    return { label: 'Avoid', color: 'bg-destructive/15 text-destructive', emoji: '🔴' };
  };
  const verdict = getVerdict(scoreValue);

  // Letter grades
  const getGrade = (s: number | null) => {
    if (s === null) return '—';
    if (s >= 85) return 'A';
    if (s >= 70) return 'B';
    if (s >= 55) return 'C';
    if (s >= 40) return 'D';
    return 'F';
  };

  const getGradeColor = (s: number | null) => {
    if (s === null) return 'text-muted-foreground';
    if (s >= 70) return 'text-success';
    if (s >= 55) return 'text-warning';
    return 'text-destructive';
  };

  const dimensions = [
    { key: 'labor', label: 'Worker Rights', score: dimScores.labor },
    { key: 'environment', label: 'Environment', score: dimScores.environment },
    { key: 'politics', label: 'Political Influence', score: dimScores.politics },
    { key: 'social', label: 'Social Impact', score: dimScores.social },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Back button */}
        {cameFromBrand && (
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-mt-2 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}

        {/* ─── Brand Identity ─── */}
        <BrandIdentityHeader 
          brandName={displayProfile?.display_name || brand.name} 
          logoUrl={displayProfile?.logo_url || brand.logo_url} 
          website={brand.website}
          subtitle={displayProfile?.category_label || undefined}
        />

        {/* ─── 1. INSTANT VERDICT ─── */}
        <div className={`${verdict.color} border border-border p-5`}>
           <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Rating</p>
              <div className="text-5xl font-extrabold tracking-tighter mt-1" style={{ fontFamily: "'Public Sans', sans-serif" }}>
                {scoreValue !== null ? scoreValue : '—'}
                <span className="text-lg font-normal text-muted-foreground ml-1">/ 100</span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <span className="text-2xl">{verdict.emoji}</span>
              <p className="text-lg font-bold mt-1">{verdict.label}</p>
              {resolvedBrandId && <ConfidenceBadge brandId={resolvedBrandId} />}
            </div>
          </div>

          {/* Top reasons */}
          {resolvedBrandId && (
            <ReasonProofList
              brandId={resolvedBrandId}
              brandName={brand.name}
              parentName={brand.parent_company}
              scores={{
                score_labor: dimScores.labor,
                score_environment: dimScores.environment,
                score_politics: dimScores.politics,
                score_social: dimScores.social,
                overall: scoreValue,
              }}
            />
          )}

          {/* Score transparency */}
          {resolvedBrandId && scoreValue !== null && (
            <div className="mt-3 border-t border-border/50 pt-1">
              <ScoreTransparency brandId={resolvedBrandId} brandName={brand.name} />
            </div>
          )}
        </div>

        {/* Enrichment progress removed — no pipeline UI */}

        {/* ─── 2. OWNERSHIP REVEAL ─── */}
        {resolvedBrandId && (
          <OwnershipDisplay brandId={resolvedBrandId} brandSlug={brand.slug} scannedBrandId={scannedBrandId} scannedBrandName={scannedBrandName} />
        )}




        {/* ─── 3. BETTER ALTERNATIVES (moved up) ─── */}
        {resolvedBrandId && (
          <AlternativesSection brandId={resolvedBrandId} brandName={brand.name} />
        )}

        {/* ─── 3b. COMMUNITY OUTLOOK ─── */}
        {resolvedBrandId && (
          <div className="mt-6">
            <CommunityOutlookCard brandId={resolvedBrandId} brandName={brand?.name || "This brand"} />
            <div className="mt-3 flex justify-center">
              <Button variant="outline" onClick={() => setShowRateModal(true)}>
                Rate this brand
              </Button>
            </div>
            <RateBrandModal
              open={showRateModal}
              onOpenChange={setShowRateModal}
              brandId={resolvedBrandId}
              brandName={brand?.name || "This brand"}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Community opinions evolve over time
            </p>
          </div>
        )}

        {/* ─── 4. DETAILS (collapsible) ─── */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer p-4 bg-elevated-1 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            View detailed breakdown & evidence
            <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-2 space-y-4">
            <Card>
              <CardContent className="pt-5 pb-5 space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Score Breakdown</p>
                {dimensions.map(dim => (
                  <div key={dim.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm font-medium">{dim.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${getGradeColor(dim.score)}`}>
                        {getGrade(dim.score)}
                      </span>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {dim.score != null ? Math.round(dim.score) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Evidence</p>
                  {resolvedBrandId && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate(`/proof/${resolvedBrandId}`)}>
                      View all →
                    </Button>
                  )}
                </div>
                {resolvedBrandId && <EvidenceList brandId={resolvedBrandId} />}
              </CardContent>
            </Card>
          </div>
        </details>

        {/* Description */}
        {brand.description && brand.identity_confidence !== 'low' && (
          <Card>
            <CardContent className="pt-5 pb-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">About</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{brand.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Admin verify */}
        {isAdmin && brand.identity_confidence === 'low' && (
          <Button variant="outline" size="sm" className="w-full" onClick={markIdentityVerified} disabled={verifying}>
            {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Mark Identity Verified
          </Button>
        )}

        {/* Beta */}
        <p className="text-xs text-center text-muted-foreground px-4 pb-4">
          Based on verified public records. Coverage expands weekly.
        </p>
      </main>
    </div>
  );
}

// TopReasons removed — replaced by shared ReasonProofList component

