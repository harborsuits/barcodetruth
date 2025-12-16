import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ExternalLink, AlertCircle, Building2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { useAutoEnrichment } from '@/hooks/useAutoEnrichment';
import { isUUID } from '@/lib/utils';

// V1 Consumer Contract:
// Card 1: Header (name, logo, description)
// Card 2: Ownership ("Owned by X" or fallback)
// Card 3: Score (simple 0-100 or "Score coming soon")
// Card 4: Evidence (2-3 items or "No evidence yet")

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
    if (s >= 70) return 'Good';
    if (s >= 40) return 'Average';
    return 'Poor';
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
  const parentCompany = chain.length > 1 ? chain[chain.length - 1] : null;
  
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
  
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      <div>
        <p className="font-medium">Independently Operated</p>
        <p className="text-xs text-muted-foreground">Or ownership data pending</p>
      </div>
    </div>
  );
}

function EvidenceList({ brandId }: { brandId: string }) {
  const { data: evidence, isLoading } = useQuery({
    queryKey: ['brand-evidence-v1', brandId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('brand_events')
        .select('event_id, title, event_date, category, source_url')
        .eq('brand_id', brandId)
        .eq('is_irrelevant', false)
        .gte('event_date', thirtyDaysAgo)
        .order('event_date', { ascending: false })
        .limit(3);
      
      if (error) return [];
      return data || [];
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
      {evidence.map((ev) => (
        <div key={ev.event_id} className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium line-clamp-2">{ev.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground capitalize">{ev.category}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {new Date(ev.event_date).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BrandProfileV1() {
  const { id, brandId } = useParams<{ id?: string; brandId?: string }>();
  const navigate = useNavigate();
  const slugOrId = id || brandId;
  const isUuidRoute = isUUID(slugOrId);
  
  const routerLocation = useLocation();
  const cameFromBrand = (routerLocation as any)?.state?.fromBrand;

  // Query brand info
  const { data: brand, isLoading: brandLoading, error: brandError } = useQuery({
    queryKey: ['brand-v1', slugOrId],
    enabled: !!slugOrId,
    queryFn: async () => {
      const query = isUuidRoute
        ? supabase.from('brands').select('*').eq('id', slugOrId).limit(1).maybeSingle()
        : supabase.from('brands').select('*').eq('slug', slugOrId).limit(1).maybeSingle();
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
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

  // Loading state
  if (brandLoading) {
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

  // Error state
  if (brandError || !brand) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
          <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Brand not found</h1>
          <p className="text-muted-foreground">The brand you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/search')}>Search Brands</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Back button */}
        {cameFromBrand && (
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-mt-2 mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
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
                ) : brand.identity_confidence === 'low' && brand.description ? (
                  <p className="text-sm text-muted-foreground/60 italic mt-2">
                    Description pending verification
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    No description yet
                  </p>
                )}
                
                {/* Show identity warning for low confidence */}
                {brand.identity_confidence === 'low' && brand.identity_notes && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {brand.identity_notes}
                  </p>
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

        {/* Card 3: Score */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-3">Should I care?</h2>
            <ScoreDisplay score={scoreData?.score ?? null} />
          </CardContent>
        </Card>

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
