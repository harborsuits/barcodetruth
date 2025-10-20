import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BrandWikiEnrichment } from '@/components/BrandWikiEnrichment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink, AlertCircle, Building2, Link as LinkIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { getCategoryDisplay, type CategoryGroup } from '@/lib/categoryConfig';

type BrandProfile = {
  brand: { 
    id: string; 
    name: string; 
    parent_company?: string | null;
    website?: string | null;
    description?: string | null;
    description_source?: string | null;
    logo_url?: string | null;
    logo_attribution?: string | null;
  } | null;
  score?: { 
    score: number | null; 
    updated_at: string | null; 
    reason_json?: any | null 
  } | null;
  coverage?: {
    events_7d?: number;
    events_30d: number;
    events_90d?: number;
    events_365d: number;
    verified_rate: number; 
    independent_sources: number; 
    last_event_at?: string | null;
  } | null;
  ownership?: {
    upstream: Array<{
      brand_id: string;
      brand_name: string;
      relationship: string;
      confidence: number;
      source: string;
    }>;
    downstream: Array<{
      brand_id: string;
      brand_name: string;
      relationship: string;
      confidence: number;
    }>;
  } | null;
  evidence: Array<{
    event_date: string; 
    title: string; 
    verification: string | null;
    source_name: string | null; 
    canonical_url: string | null;
    category: string | null;
    category_code?: string | null;
    ai_summary?: string | null;
  }>;
};

// Logo component with instant fallback
function BrandLogoWithFallback({ 
  logoUrl, 
  website, 
  brandName, 
  monogram 
}: { 
  logoUrl?: string | null; 
  website?: string | null; 
  brandName: string; 
  monogram: string;
}) {
  const displayLogo = useBrandLogo(logoUrl || null, website);
  
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

export default function BrandProfile() {
  const { id, brandId } = useParams<{ id?: string; brandId?: string }>();
  const navigate = useNavigate();
  const actualId = id || brandId;
  
  const [data, setData] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Get current user for personalized scoring
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user);
    });
  }, []);

  // Fetch personalized score if user is logged in
  const { data: personalizedScore } = useQuery({
    queryKey: ['personalized-score', actualId, user?.id],
    queryFn: async () => {
      if (!actualId || !user?.id) return null;
      
      // Use direct RPC call since types not yet updated
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/personalized_brand_score`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({
            p_brand_id: actualId,
            p_user_id: user.id
          })
        }
      );
      
      if (!response.ok) return null;
      const result = await response.json();
      return result?.[0] ?? null;
    },
    enabled: !!actualId && !!user?.id,
  });

  useEffect(() => {
    if (!actualId) {
      setError('Brand ID is required');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .rpc('brand_profile_view', { p_brand_id: actualId });

        if (profileError) throw profileError;
        if (!profileData) throw new Error('Brand not found');

        // Cast to any to work with the JSON structure
        const rawData: any = profileData;
        
        // Cast to BrandProfile type
        const result = rawData as BrandProfile;
        
        console.log('[BrandProfile] RPC result:', {
          brand_id: actualId,
          brand_name: result?.brand?.name,
          evidence_count: result?.evidence?.length ?? 0,
          evidence_sample: result?.evidence?.slice(0, 2),
          coverage: result?.coverage,
          has_error: !!profileError
        });
        
        if (!result?.brand) {
          setError('Brand not found');
          return;
        }

        setData(result);
      } catch (e: any) {
        console.error('Failed to load brand profile:', e);
        setError(e?.message ?? 'Failed to load brand profile');
        toast({
          title: 'Error loading brand',
          description: e?.message ?? 'Failed to load brand profile',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [actualId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card border-b">
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-16 w-24" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (error || !data?.brand) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-card border-b">
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="container max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
          <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Brand not found</h1>
          <p className="text-muted-foreground">{error || 'The brand you\'re looking for doesn\'t exist.'}</p>
          <Button onClick={() => navigate('/search')}>Search Brands</Button>
        </main>
      </div>
    );
  }

  // Use personalized score if available, otherwise global score
  const displayScore = personalizedScore?.personalized_score ?? data.score?.score ?? null;
  const coverage = data.coverage ?? {
    events_7d: 0,
    events_30d: 0,
    events_90d: 0,
    events_365d: 0,
    verified_rate: 0,
    independent_sources: 0,
    last_event_at: null
  };

  // Create monogram from brand name
  const monogram = data.brand.name?.[0]?.toUpperCase() ?? 'B';

  return (
    <div className="min-h-screen bg-background">
      <BrandWikiEnrichment brandId={actualId!} hasDescription={!!data.brand.description} />
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Brand Profile</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header with brand info and score */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <BrandLogoWithFallback 
                logoUrl={data.brand.logo_url} 
                website={data.brand.website}
                brandName={data.brand.name}
                monogram={monogram}
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold truncate">{data.brand.name}</h2>
                
                {/* Ownership badges */}
                {data.ownership?.upstream && data.ownership.upstream.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.ownership.upstream.map((o, i) => (
                      <Badge 
                        key={i} 
                        variant="outline" 
                        className="text-xs gap-1 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/brand/${o.brand_id}`)}
                      >
                        <Building2 className="h-3 w-3" />
                        {o.relationship.replace('_', ' ')} • {o.brand_name || o.brand_id.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                )}
                {data.ownership?.downstream && data.ownership.downstream.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.ownership.downstream.map((o, i) => (
                      <Badge 
                        key={i} 
                        variant="secondary" 
                        className="text-xs gap-1 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => navigate(`/brand/${o.brand_id}`)}
                      >
                        <Building2 className="h-3 w-3" />
                        owns • {o.brand_name || o.brand_id.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {data.brand.parent_company && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Parent: {data.brand.parent_company}
                  </p>
                )}
                {data.brand.website && (
                  <a 
                    href={data.brand.website} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    Visit website <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                
                {/* Wikipedia description */}
                {data.brand.description ? (
                  <div className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    <p>{data.brand.description}</p>
                    {data.brand.description_source === 'wikipedia' && (
                      <a
                        href={`https://en.wikipedia.org/wiki/${encodeURIComponent(data.brand.name)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        Source: Wikipedia <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground italic flex items-center gap-2">
                    <div className="animate-pulse">●</div>
                    <span>Auto-enriching summary from Wikipedia...</span>
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-5xl font-bold">
                  {displayScore !== null && displayScore !== undefined ? Math.round(displayScore) : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-1">
                  {personalizedScore ? (
                    <span className="text-primary font-medium">Your personalized score</span>
                  ) : data.score?.updated_at ? (
                    `Updated ${formatDistanceToNow(new Date(data.score.updated_at), { addSuffix: true })}`
                  ) : (
                    'Not scored yet'
                  )}
                   {/* Trend indicators */}
                  {coverage.events_30d > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {coverage.events_30d} events (30d)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coverage chips */}
        <section className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1">
            7d: {coverage.events_7d ?? 0}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            30d: {coverage.events_30d}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            90d: {coverage.events_90d ?? 0}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            365d: {coverage.events_365d}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            Verified: {Math.round(coverage.verified_rate)}%
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            Sources: {coverage.independent_sources}
          </Badge>
        </section>

        {/* Why this score accordion */}
        <Card>
          <CardHeader>
            <details className="cursor-pointer">
              <summary className="font-semibold text-lg list-none flex items-center justify-between">
                Why this score?
                <span className="text-muted-foreground text-sm">▼</span>
              </summary>
              <div className="mt-4 pt-4 border-t">
                {data.score?.reason_json ? (
                  <pre className="text-xs overflow-auto bg-muted p-4 rounded">
                    {JSON.stringify(data.score.reason_json, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No detailed breakdown available yet. Scores are calculated based on verified events, 
                    source credibility, and recency.
                  </p>
                )}
              </div>
            </details>
          </CardHeader>
        </Card>

        {/* Evidence - Sorted by Impact */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold">Evidence</h3>
              
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'All', value: 'all' },
                  { label: 'Financial', value: 'FIN' },
                  { label: 'Product Safety', value: 'PRODUCT' },
                  { label: 'Legal', value: 'LEGAL' },
                  { label: 'Regulatory', value: 'REGULATORY' },
                  { label: 'Labor', value: 'LABOR' },
                  { label: 'ESG', value: 'ESG' },
                  { label: 'Policy', value: 'POLICY' },
                  { label: 'Social & Cultural', value: 'SOCIAL' },
                  { label: 'Noise', value: 'NOISE' },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setCategoryFilter(filter.value)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      categoryFilter === filter.value
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted border-border'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const getVerificationScore = (v: string | null) => 
                v === 'official' ? 3 : v === 'corroborated' ? 2 : 1;
              
              const getRecencyScore = (date: string) => {
                const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
                if (days <= 30) return 3;
                if (days <= 90) return 2;
                if (days <= 365) return 1;
                return 0;
              };
              
              const filteredEvidence = categoryFilter === 'all' 
                ? (data.evidence ?? [])
                : (data.evidence ?? []).filter(e => e.category_code?.startsWith(categoryFilter));
              
              // Sort by verification (official first), then recency (newest first)
              const sortedEvidence = [...filteredEvidence].sort((a, b) => {
                const verificationDiff = getVerificationScore(b.verification) - getVerificationScore(a.verification);
                if (verificationDiff !== 0) return verificationDiff;
                
                const recencyDiff = getRecencyScore(b.event_date) - getRecencyScore(a.event_date);
                if (recencyDiff !== 0) return recencyDiff;
                
                return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
              });
              
              console.log('[BrandProfile] Evidence sorted by impact:', {
                brand_id: actualId,
                total: sortedEvidence.length,
                official: sortedEvidence.filter(e => e.verification === 'official').length,
                recent_30d: sortedEvidence.filter(e => getRecencyScore(e.event_date) === 3).length,
                raw_evidence_count: data.evidence?.length ?? 0,
                filtered_count: filteredEvidence.length,
                category_filter: categoryFilter,
                evidence_sample: filteredEvidence?.[0]
              });

              if (!sortedEvidence.length) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      {categoryFilter === 'all' 
                        ? 'No evidence available yet for this brand.'
                        : `No ${categoryFilter} events found for this brand.`
                      }
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {sortedEvidence.map((ev, idx) => {
                    const isOfficial = ev.verification === 'official';
                    const isCorroborated = ev.verification === 'corroborated';
                    const isRecent = getRecencyScore(ev.event_date) === 3;
                    
                    return (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-lg border transition-colors ${
                          isOfficial ? 'border-destructive/50 bg-destructive/5' : 
                          isCorroborated ? 'border-primary/50 bg-primary/5' : 
                          'border-border bg-card'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon based on verification */}
                          <div className={`mt-0.5 flex-shrink-0 ${
                            isOfficial ? 'text-destructive' : 
                            isCorroborated ? 'text-primary' : 
                            'text-muted-foreground'
                          }`}>
                            {isOfficial ? '⚠️' : isCorroborated ? '⚖️' : '📰'}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge 
                                variant={
                                  isOfficial ? 'destructive' : 
                                  isCorroborated ? 'default' : 
                                  'outline'
                                }
                                className="text-xs"
                              >
                                {ev.verification === 'official' ? 'Official' : 
                                 ev.verification === 'corroborated' ? 'Multiple Sources' : 
                                 'Unverified'}
                              </Badge>
                              
                              {(() => {
                                const categoryDisplay = getCategoryDisplay(ev.category_code);
                                return (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${categoryDisplay.color}`}
                                  >
                                    {categoryDisplay.group}: {categoryDisplay.label}
                                  </Badge>
                                );
                              })()}
                              
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(ev.event_date), { addSuffix: true })}
                              </span>
                            </div>
                            
                            {/* Title */}
                            <h4 className="font-semibold text-base leading-tight mb-2">
                              {ev.title || 'Untitled Event'}
                            </h4>
                            
                            {/* AI Summary */}
                            {ev.ai_summary && (
                              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                                {ev.ai_summary}
                              </p>
                            )}
                            
                            {/* Source link */}
                            {ev.canonical_url && (
                              <a
                                href={ev.canonical_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                {ev.source_name || 'Read more'}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Secondary actions */}
        <div className="flex gap-3 justify-center pb-6">
          <Button variant="outline" size="sm" disabled>
            Report an issue
          </Button>
          <Button variant="outline" size="sm" disabled>
            Suggest evidence
          </Button>
        </div>
      </main>
    </div>
  );
}
