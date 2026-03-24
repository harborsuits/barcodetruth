import { useEffect, useState } from 'react';
import { AlternativesSection } from '@/components/brand/AlternativesSection';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ExternalLink, AlertCircle, Building2, Loader2, ShieldCheck, Bell, BellOff, Trophy, Clock } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { useAutoEnrichment } from '@/hooks/useAutoEnrichment';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';
import { isUUID } from '@/lib/utils';
import { PersonalizedScoreDisplay } from '@/components/brand/PersonalizedScoreDisplay';
import { TrustPledge } from '@/components/brand/TrustPledge';
import { formatDistanceToNow } from 'date-fns';
import { useProfileState } from '@/hooks/useProfileState';
import { BuildingProfile } from '@/components/brand/BuildingProfile';
import { NeedsReviewProfile } from '@/components/brand/NeedsReviewProfile';
import { PowerProfitCard } from '@/components/brand/PowerProfitCard';
import { deduplicateEvents } from '@/lib/deduplicateEvents';
import { BrandCoverageStatus } from '@/components/brand/BrandCoverageStatus';

// V1 Consumer Contract - with 3 explicit states:
// State A: Assessable (full profile) - identity verified + 3+ dimensions with evidence
// State B: Building (in progress) - gathering evidence, show progress
// State C: Needs Review (mismatch) - identity confidence low or name mismatch detected

function BrandLogo({ 
  logoUrl, 
  website, 
  brandName 
}: { 
  logoUrl?: string | null; 
  website?: string | null; 
  brandName: string;
}) {
  const displayLogo = useBrandLogo(logoUrl || null, website);
  const monogram = brandName?.[0]?.toUpperCase() ?? 'B';
  
  if (displayLogo) {
    return (
      <img 
        src={displayLogo} 
        alt={`${brandName} logo`}
        className="w-16 h-16 rounded-2xl border-2 object-contain bg-muted flex-shrink-0 p-2"
        loading="lazy"
      />
    );
  }
  
  return (
    <div className="w-16 h-16 rounded-2xl border-2 grid place-items-center text-2xl font-bold bg-muted flex-shrink-0">
      {monogram}
    </div>
  );
}

function EnrichmentProgress({ 
  status, 
  message, 
  step, 
  totalSteps 
}: { 
  status: string; 
  message: string; 
  step: number; 
  totalSteps: number;
}) {
  if (status === 'idle' || status === 'complete') return null;
  
  return (
    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <Progress value={(step / totalSteps) * 100} className="h-1" />
    </div>
  );
}

function ScoreDisplay({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">Score coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          Monitoring in progress — score will appear once enough verified events are collected.
        </p>
      </div>
    );
  }
  
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'text-green-600';
    if (s >= 40) return 'text-yellow-600';
    return 'text-red-600';
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

function OwnershipDisplay({ brandId }: { brandId: string }) {
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
  
  // Case 1: Has a parent company above it
  if (parentCompany) {
    return (
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="text-sm text-muted-foreground">Corporate Owner</p>
          <p className="font-semibold">{parentCompany.name}</p>
        </div>
      </div>
    );
  }
  
  // Case 2: This IS a public parent company (no parent above it)
  if (isPublicCompany && selfEntity) {
    return (
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div>
          <p className="font-medium">Public Company</p>
          <p className="text-xs text-muted-foreground">
            {selfEntity.name} is publicly traded — no parent corporation
          </p>
        </div>
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
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary inline-flex items-center gap-1">
                SOURCE_DATA <ExternalLink className="h-2.5 w-2.5" /> →
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
            className="w-full font-mono text-[10px] uppercase tracking-widest"
            onClick={() => navigate(`/proof/${brandId}`)}
          >
            LOAD FULL AUDIT TRAIL ({totalCount} items) →
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
  const slugOrId = id || brandId;
  const isUuidRoute = isUUID(slugOrId);
  
  const routerLocation = useLocation();
  const cameFromBrand = (routerLocation as any)?.state?.fromBrand;

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

  // State A: Assessable (full profile) - Forensic Editorial layout

  const scoreValue = scoreData?.score ? Math.round(JSON.parse(JSON.stringify(scoreData.score))?.overall ?? scoreData.score ?? 0) : null;

  const getAlignmentLabel = (s: number | null) => {
    if (s === null) return { text: 'Pending', className: 'bg-muted text-muted-foreground' };
    if (s >= 70) return { text: 'High Alignment', className: 'bg-success/20 text-success' };
    if (s >= 40) return { text: 'Mixed Record', className: 'bg-warning/20 text-warning' };
    return { text: 'Low Alignment', className: 'text-data' };
  };

  const alignment = getAlignmentLabel(scoreValue);

  return (
    <div className="min-h-screen bg-background forensic-grid">
      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Back button */}
        {cameFromBrand && (
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-mt-2 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}

        {/* ═══ REPORT HEADER ═══ */}
        <div className="space-y-4">
          {/* Brand identity row */}
          <div className="flex items-start gap-4">
            <BrandLogo 
              logoUrl={brand.logo_url} 
              website={brand.website}
              brandName={brand.name}
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
              {brand.website && (
                <a 
                  href={brand.website} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  <ExternalLink className="h-3 w-3" />
                  {new URL(brand.website).hostname.replace('www.', '')}
                </a>
              )}
              <p className="label-forensic mt-1">
                Report #{brand.id.slice(0, 4).toUpperCase()}-{brand.id.slice(4, 5).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Score hero */}
          <div className="bg-elevated-1 border border-border p-6 flex items-center justify-between">
            <div>
              <p className="label-forensic mb-1">Composite Score</p>
              <div className="text-6xl font-extrabold tracking-tighter" style={{ fontFamily: "'Public Sans', sans-serif" }}>
                {scoreValue !== null ? scoreValue : '—'}
              </div>
            </div>
            <div className="text-right space-y-2">
              <Badge className={`${alignment.className} text-xs font-mono uppercase tracking-wider px-3 py-1`}>
                {alignment.text}
              </Badge>
              {brand.identity_confidence && brand.identity_confidence !== 'low' && (
                <p className="text-xs text-muted-foreground">
                  Identity: {brand.identity_confidence}
                </p>
              )}
            </div>
          </div>

          {/* Enrichment progress */}
          {enrichmentProgress.status === 'enriching' && (
            <EnrichmentProgress 
              status={enrichmentProgress.status}
              message={enrichmentProgress.message}
              step={enrichmentProgress.step}
              totalSteps={enrichmentProgress.totalSteps}
            />
          )}

          {/* Pending/Building Banner */}
          {isPending && (
            <div className="border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
              <Trophy className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-warning">Profile in progress</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We're gathering evidence for this brand. Follow for updates.
                </p>
              </div>
            </div>
          )}

          {/* Failed Banner */}
          {isFailed && (
            <div className="border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Verification pending — retrying automatically</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Content below may be incomplete.
                </p>
                {brand.next_enrichment_at && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next retry: {formatDistanceToNow(new Date(brand.next_enrichment_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ METRIC DISTRIBUTION ═══ */}
        {resolvedBrandId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="label-forensic">FORENSIC METRIC DISTRIBUTION</h2>
              <span className="font-mono text-[10px] text-muted-foreground">{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
            <MetricDistribution brandId={resolvedBrandId} />
          </div>
        )}

        {/* ═══ BRAND OVERVIEW ═══ */}
        <div className="bg-elevated-1 border border-border p-5 space-y-3">
          <h2 className="label-forensic">Brand Overview</h2>
          {brand.description && brand.identity_confidence !== 'low' ? (
            <p className="text-sm text-foreground/80 leading-relaxed">
              {brand.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {brandStatus === 'stub' || brandStatus === 'building' 
                ? 'Building brand profile…'
                : brand.identity_confidence === 'low'
                ? 'Description pending verification'
                : 'No description yet'}
            </p>
          )}
          
          {/* Key facts row */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
            {brand.parent_company && (
              <div>
                <p className="label-forensic text-[10px]">Parent Company</p>
                <p className="text-sm font-medium text-foreground">{brand.parent_company}</p>
              </div>
            )}
            {brand.website && (
              <div>
                <p className="label-forensic text-[10px]">Domain</p>
                <p className="text-sm font-medium text-foreground">{new URL(brand.website).hostname.replace('www.', '')}</p>
              </div>
            )}
            {brand.wikidata_qid && (
              <div>
                <p className="label-forensic text-[10px]">Wikidata</p>
                <p className="text-sm font-medium text-foreground font-mono">{brand.wikidata_qid}</p>
              </div>
            )}
          </div>

          {/* Admin verify button */}
          {isAdmin && brand.identity_confidence === 'low' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={markIdentityVerified}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Mark Identity Verified
            </Button>
          )}
        </div>

        {/* ═══ POWER METRICS ═══ */}
        {resolvedBrandId && (
          <PowerProfitCard brandId={resolvedBrandId} brandName={brand.name} />
        )}

        {/* ═══ PERSONALIZED SCORE ═══ */}
        {resolvedBrandId && (
          <PersonalizedScoreDisplay 
            brandId={resolvedBrandId} 
            brandName={brand.name}
            identityConfidence={brand.identity_confidence}
          />
        )}

        {/* ═══ FORENSIC EVIDENCE ═══ */}
        <div className="space-y-3">
          <h2 className="label-forensic">FORENSIC EVIDENCE REPOSITORY</h2>
          
          {/* Coverage status */}
          <BrandCoverageStatus 
            status={brand.news_coverage_status}
            lastCheckedAt={brand.last_news_check_at}
            materialEventCount={brand.material_event_count_30d}
          />

          <div className="bg-elevated-1 border border-border">
            {resolvedBrandId && <EvidenceList brandId={resolvedBrandId} />}
          </div>
        </div>

        {/* ═══ ETHICAL ALTERNATIVES ═══ */}
        {resolvedBrandId && (
          <div className="space-y-3">
            <h2 className="label-forensic">Ethical Alternatives</h2>
            <AlternativesSection brandId={resolvedBrandId} brandName={brand.name} />
          </div>
        )}

        {/* ═══ FOOTER LINKS ═══ */}
        <div className="flex items-center justify-center gap-4 py-4 border-t border-border">
          <button 
            className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono uppercase tracking-wider"
            onClick={() => {/* scroll to score */}}
          >
            Why This Score
          </button>
          <span className="text-border">|</span>
          <button 
            className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono uppercase tracking-wider"
          >
            How We Stay Neutral
          </button>
          <span className="text-border">|</span>
          <button 
            className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono uppercase tracking-wider"
            onClick={() => resolvedBrandId && navigate(`/proof/${resolvedBrandId}`)}
          >
            Show Me Proof
          </button>
        </div>

        {/* Beta banner */}
        <p className="text-xs text-center text-muted-foreground px-4">
          Early beta — coverage expands weekly.
        </p>
      </main>
    </div>
  );
}

/* ═══ METRIC DISTRIBUTION COMPONENT ═══ */
function MetricDistribution({ brandId }: { brandId: string }) {
  const { data: scores, isLoading } = useQuery({
    queryKey: ['brand-dimension-scores', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_scores')
        .select('score')
        .eq('brand_id', brandId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const s = typeof data.score === 'string' ? JSON.parse(data.score) : data.score;
      return {
        labor: s?.score_labor ?? null,
        environment: s?.score_environment ?? null,
        politics: s?.score_politics ?? null,
        social: s?.score_social ?? null,
      };
    },
    enabled: !!brandId,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  const dimensions = [
    { key: 'labor', label: 'Worker Rights', icon: '👷', cssVar: 'labor' },
    { key: 'environment', label: 'Environment', icon: '🌍', cssVar: 'environment' },
    { key: 'politics', label: 'Political', icon: '🏛️', cssVar: 'politics' },
    { key: 'social', label: 'Social', icon: '🤝', cssVar: 'social' },
  ] as const;

  const getSeverity = (score: number | null): { label: string; className: string } => {
    if (score === null) return { label: 'Pending', className: 'text-muted-foreground' };
    if (score >= 70) return { label: 'Good', className: 'text-success' };
    if (score >= 50) return { label: 'Warning', className: 'text-warning' };
    if (score >= 30) return { label: 'Low', className: 'text-destructive' };
    return { label: 'Critical', className: 'text-destructive' };
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {dimensions.map(dim => {
        const value = scores?.[dim.key] ?? null;
        const severity = getSeverity(value);
        return (
          <div 
            key={dim.key} 
            className="bg-elevated-1 border border-border p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{dim.icon}</span>
              <span className="label-forensic text-[10px]">{dim.label}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                {value !== null ? Math.round(value) : '—'}
              </span>
              <Badge 
                variant="outline" 
                className={`${severity.className} text-[10px] font-mono uppercase tracking-wider border-current/20`}
              >
                {severity.label}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
