import { useEffect, useState } from 'react';
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
      // Removed 30-day filter - show all relevant events
      const { data, error } = await supabase
        .from('brand_events')
        .select('event_id, title, event_date, category, source_url')
        .eq('brand_id', brandId)
        .eq('is_irrelevant', false)
        .order('event_date', { ascending: false })
        .limit(5); // Increased from 3 to 5
      
      if (error) return [];
      return data || [];
    },
    enabled: !!brandId,
  });
  
  // Get total count for "View all" link
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
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  
  if (!evidence || evidence.length === 0) {
    return (
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">No evidence yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Event coverage expanding — no verified events for this brand yet.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {evidence.map((ev) => {
        const hasUrl = !!ev.source_url;
        const content = (
          <>
            <p className="text-sm font-medium line-clamp-2">{ev.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground capitalize">{ev.category}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {new Date(ev.event_date).toLocaleDateString()}
              </span>
              {hasUrl && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-primary inline-flex items-center gap-1">
                    View source <ExternalLink className="h-3 w-3" />
                  </span>
                </>
              )}
            </div>
          </>
        );

        if (hasUrl) {
          return (
            <a 
              key={ev.event_id} 
              href={ev.source_url!} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              {content}
            </a>
          );
        }

        return (
          <div key={ev.event_id} className="p-3 bg-muted/50 rounded-lg opacity-60">
            {content}
          </div>
        );
      })}
      
      {/* View all link */}
      {(totalCount || 0) > 5 && (
        <Button 
          variant="ghost" 
          className="w-full text-sm"
          onClick={() => navigate(`/proof/${brandId}`)}
        >
          View all {totalCount} evidence items →
        </Button>
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

  // State A: Assessable (full profile) - continue to render full profile below

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Back button */}
        {cameFromBrand && (
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-mt-2 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}

        {/* Pending/Building Profile Banner */}
        {isPending && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                    Profile in progress
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                    We're gathering evidence for this brand. Follow for updates.
                  </p>
                  {fromPendingSubmission && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Thanks for contributing — you're an early contributor!
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failed Status Banner - but still show all available content */}
        {isFailed && (
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                    Verification pending — retrying automatically
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
                    We're still verifying this brand's identity. Content below may be incomplete.
                  </p>
                  {brand.next_enrichment_at && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-orange-600 dark:text-orange-400">
                      <Clock className="h-3 w-3" />
                      <span>
                        Next retry: {formatDistanceToNow(new Date(brand.next_enrichment_at), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card 1: Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <BrandLogo 
                logoUrl={brand.logo_url} 
                website={brand.website}
                brandName={brand.name}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold truncate">{brand.name}</h1>
                  {brandStatus && brandStatus !== 'ready' && (
                    <Badge variant="secondary" className="text-xs">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Building...
                    </Badge>
                  )}
                </div>
                {brand.website && (
                  <a 
                    href={brand.website} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    Visit website <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {/* Only show description if identity_confidence is medium/high */}
                {brand.description && brand.identity_confidence !== 'low' ? (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                    {brand.description}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-muted-foreground/60 italic">
                      {brandStatus === 'stub' || brandStatus === 'building' 
                        ? 'Building brand profile…'
                        : brandStatus === 'failed'
                        ? 'Build failed — retrying soon'
                        : brand.identity_confidence === 'low' && brand.description
                        ? 'Description pending verification'
                        : 'No description yet'}
                    </p>
                    {/* Status explanation */}
                    <p className="text-xs text-muted-foreground/50">
                      {brandStatus === 'stub' || brandStatus === 'building' 
                        ? 'Enrichment in progress'
                        : brandStatus === 'failed'
                        ? 'Enrichment will retry automatically'
                        : brand.identity_confidence === 'low'
                        ? 'Pending verification (to prevent incorrect matches)'
                        : 'Coverage expanding soon'}
                    </p>
                    {/* Admin: show build error if failed */}
                    {isAdmin && brandStatus === 'failed' && brand.last_build_error && (
                      <p className="text-xs text-destructive mt-1">
                        Error: {brand.last_build_error}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Admin: Mark identity verified button */}
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
            </div>
            
            {/* Show enrichment progress if actively enriching */}
            {enrichmentProgress.status === 'enriching' && (
              <div className="mt-4">
                <EnrichmentProgress 
                  status={enrichmentProgress.status}
                  message={enrichmentProgress.message}
                  step={enrichmentProgress.step}
                  totalSteps={enrichmentProgress.totalSteps}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Ownership */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-3">Who owns this brand?</h2>
            {resolvedBrandId && <OwnershipDisplay brandId={resolvedBrandId} />}
          </CardContent>
        </Card>

        {/* Card 3: Personalized Score */}
        {resolvedBrandId && (
          <PersonalizedScoreDisplay 
            brandId={resolvedBrandId} 
            brandName={brand.name}
            identityConfidence={brand.identity_confidence}
          />
        )}

        {/* Trust Pledge - How We Stay Neutral */}
        <TrustPledge />

        {/* Card 4: Evidence */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-3">Show me proof</h2>
            {resolvedBrandId && <EvidenceList brandId={resolvedBrandId} />}
          </CardContent>
        </Card>

        {/* Early beta banner */}
        <p className="text-xs text-center text-muted-foreground px-4">
          Early beta — coverage expands weekly. Parent companies and scores for major brands available today.
        </p>
      </main>
    </div>
  );
}
