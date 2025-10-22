import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BrandWikiEnrichment } from '@/components/BrandWikiEnrichment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, ExternalLink, AlertCircle, Building2, Link as LinkIcon } from 'lucide-react';
import { CategoryScoreCard } from '@/components/brand/CategoryScoreCard';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBrandLogo } from '@/hooks/useBrandLogo';
import { getCategoryDisplay, type CategoryGroup } from '@/lib/categoryConfig';
import { OwnershipGraph } from '@/components/ownership/OwnershipGraph';
import { OwnershipTrail } from '@/components/ownership/OwnershipTrail';
import { SubsidiaryFeed } from '@/components/ownership/SubsidiaryFeed';
import { RollupScores } from '@/components/ownership/RollupScores';
import { DataCollectionBadge } from '@/components/brand/DataCollectionBadge';
import { ReportIssueDialog } from '@/components/ReportIssueDialog';
import { SuggestEvidenceDialog } from '@/components/SuggestEvidenceDialog';
import { OwnershipTabs } from '@/components/brand/OwnershipTabs';
import { KeyPeopleRow } from '@/components/brand/KeyPeopleRow';
import { ValuationChip } from '@/components/brand/ValuationChip';
import { CommunityOutlookCard } from '@/components/brand/CommunityOutlookCard';
import { useOwnership } from '@/hooks/useOwnership';

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
    score_labor?: number | null;
    score_environment?: number | null;
    score_politics?: number | null;
    score_social?: number | null;
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

import { FEATURES } from "@/config/features";

export default function BrandProfile() {
  const { id, brandId } = useParams<{ id?: string; brandId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actualId = id || brandId;
  
  // Debug log to track brand ID
  useEffect(() => {
    console.log('[BrandProfile] Component mounted with:', {
      id,
      brandId,
      actualId,
      route: window.location.pathname
    });
    
    // Add global test helper for debugging
    (window as any).testOwnershipRPC = async (brandIdToTest?: string) => {
      const testId = brandIdToTest || actualId;
      console.log('Testing RPC for brand:', testId);
      const { data, error } = await supabase.rpc('get_brand_ownership' as any, {
        p_brand_id: testId
      });
      console.log('RPC Result:', { data, error });
      console.log('Structure chain length:', data?.structure?.chain?.length);
      console.log('Shareholders count:', data?.shareholders?.top?.length);
      return { data, error };
    };
  }, [id, brandId, actualId]);
  
  const [data, setData] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [hasSetDefaultFilter, setHasSetDefaultFilter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();

  // Check for new ownership data to hide legacy cards
  const { data: ownership } = useOwnership(actualId);
  const hasOwnershipData = 
    (ownership?.structure?.chain?.length ?? 0) > 1 ||
    (ownership?.shareholders?.top?.length ?? 0) > 0;

  // Get current user for personalized scoring
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user);
    });
  }, []);

  // Auto-switch to Noise tab if all events are noise (only on initial load)
  useEffect(() => {
    if (!data?.evidence || hasSetDefaultFilter || loading) return;
    
    const nonNoiseEvents = data.evidence.filter(ev => 
      !ev.category_code?.startsWith('NOISE')
    );
    
    // If all events are noise, default to Noise tab
    if (data.evidence.length > 0 && nonNoiseEvents.length === 0) {
      setCategoryFilter('Noise');
    }
    
    setHasSetDefaultFilter(true);
  }, [data?.evidence, hasSetDefaultFilter, loading]);

  const { data: personalizedScore } = useQuery({
    queryKey: ['personalized-score', actualId, user?.id],
    enabled: FEATURES.companyScore && Boolean(actualId) && Boolean(user?.id),
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
  });

  // Fetch data confidence to determine if we show scores or monitoring badge
  const { data: confidenceData } = useQuery({
    queryKey: ['brand-confidence', actualId],
    queryFn: async () => {
      if (!actualId) return null;
      
      // Use raw fetch until types are updated
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/brand_monitoring_status?brand_id=eq.${actualId}&select=*`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          }
        }
      );
      
      if (!response.ok) {
        console.error('Error fetching monitoring status:', response.statusText);
        return null;
      }
      const result = await response.json();
      return result?.[0] ?? null;
    },
    enabled: !!actualId,
  });

  // Fetch company info (ownership, key people, valuation)
  const { data: companyInfo, refetch: refetchCompanyInfo } = useQuery({
    queryKey: ['company-info', actualId],
    queryFn: async () => {
      if (!actualId) return null;

      const { data, error } = await supabase.rpc('get_brand_company_info', {
        p_brand_id: actualId
      });

      if (error) {
        console.error('[BrandProfile] Error fetching company info:', error);
        return null;
      }

      // Cast to any to handle JSON return type
      const result = data as any;

      console.log('[BrandProfile] Company info loaded:', {
        has_ownership: !!result?.ownership,
        parent_name: result?.ownership?.parent_name,
        has_company: !!result?.ownership?.company,
        company_name: result?.ownership?.company?.name,
        has_logo: !!result?.ownership?.company?.logo_url,
        has_description: !!result?.ownership?.company?.description,
        people_count: result?.people?.length || 0,
        has_valuation: !!result?.valuation
      });

      return result;
    },
    enabled: !!actualId,
  });

  useEffect(() => {
    if (!actualId) {
      setError('Brand ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);
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
        
        // Debug log brand data
        console.log('[BrandProfile] Brand data loaded:', {
          brand_id: actualId,
          brand_name: result?.brand?.name,
          has_logo: !!result?.brand?.logo_url,
          logo_url: result?.brand?.logo_url,
          has_description: !!result?.brand?.description,
          description_length: result?.brand?.description?.length || 0,
          parent_company: result?.brand?.parent_company
        });
      } catch (e: any) {
        console.error('[BrandProfile] Failed to load brand profile:', e);
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
  }, [actualId, refreshKey]);

  // Trigger server-side logo resolution if missing (must be before early returns)
  useEffect(() => {
    if (!actualId || !data?.brand || data.brand.logo_url) return;
    supabase.functions
      .invoke('resolve-brand-logo', {
        body: { brand_id: actualId }
      })
      .then(() => {
        setTimeout(() => setRefreshKey((k) => k + 1), 1000);
      })
      .catch((err) => console.error('resolve-brand-logo error:', err));
  }, [actualId, data?.brand?.logo_url]);

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

  // Legacy: Use personalized score if available, otherwise global score
  // Now hidden behind feature flag in favor of Community Outlook
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
      <BrandWikiEnrichment 
        brandId={actualId!} 
        hasDescription={!!data.brand.description}
        hasParentCompany={!!companyInfo?.ownership}
        onEnriched={() => {
          setRefreshKey(k => k + 1);
          refetchCompanyInfo();
        }}
      />
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
                
                {/* Legacy ownership badges - hidden when new ownership data exists */}
                {!hasOwnershipData && data.ownership?.upstream && data.ownership.upstream.length > 0 && (
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
                {!hasOwnershipData && data.ownership?.downstream && data.ownership.downstream.length > 0 && (
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
                
                {!hasOwnershipData && data.brand.parent_company && (
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
              {/* Overall company score hidden - replaced by Community Outlook */}
            </div>
          </CardContent>
        </Card>

        {/* Community Outlook - replaces overall company score */}
        <CommunityOutlookCard brandId={actualId!} brandName={data.brand.name} />

        {/* 4 Category Score Cards - Always show with baseline 50 if no data */}
        <div className="grid grid-cols-2 gap-4">
          <CategoryScoreCard 
            category="labor" 
            score={personalizedScore?.score_labor ?? data.score?.score_labor ?? 50}
            eventCount={data.evidence?.filter(e => e.category === 'labor').length || 0}
            onClick={() => setCategoryFilter('labor')}
          />
          <CategoryScoreCard 
            category="environment" 
            score={personalizedScore?.score_environment ?? data.score?.score_environment ?? 50}
            eventCount={data.evidence?.filter(e => e.category === 'environment').length || 0}
            onClick={() => setCategoryFilter('environment')}
          />
          <CategoryScoreCard 
            category="politics" 
            score={personalizedScore?.score_politics ?? data.score?.score_politics ?? 50}
            eventCount={data.evidence?.filter(e => e.category === 'politics').length || 0}
            onClick={() => setCategoryFilter('politics')}
          />
          <CategoryScoreCard 
            category="social" 
            score={personalizedScore?.score_social ?? data.score?.score_social ?? 50}
            eventCount={data.evidence?.filter(e => e.category === 'social').length || 0}
            onClick={() => setCategoryFilter('social')}
          />
        </div>

        {/* Data Collection Status - Show when confidence is not high */}
        {confidenceData && confidenceData.confidence_level !== 'high' && (
          <div className="space-y-4">
            <DataCollectionBadge
              eventCount={confidenceData.event_count}
              categoriesCovered={confidenceData.categories_covered || []}
              hasSignificantEvents={confidenceData.has_significant_events || false}
              completeness={confidenceData.completeness_percent || 0}
              confidenceLevel={confidenceData.confidence_level || 'none'}
              lastIngestAt={confidenceData.last_ingest_at}
              domains90d={confidenceData.domains_90d}
              ingestStatus={confidenceData.ingest_status}
            />

            {/* Deep scan temporarily disabled - will enable when ready */}
          </div>
        )}

        {/* Ownership Module */}
        {actualId && (
          <OwnershipTabs brandId={actualId} />
        )}

        {/* Key People (if available) */}
        {companyInfo?.people && companyInfo.people.length > 0 && (
          <Card className="p-6">
            <KeyPeopleRow people={companyInfo.people} />
          </Card>
        )}

        {/* Valuation */}
        {companyInfo?.valuation && (
          <div className="flex justify-center">
            <ValuationChip valuation={companyInfo.valuation} />
          </div>
        )}

        {/* Coverage chips with Verified % */}
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
          {confidenceData && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              Verified: {Math.round((confidenceData.verified_rate || 0) * 100)}% (90d)
            </Badge>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            Sources: {coverage.independent_sources}
          </Badge>
        </section>

        {/* Why this score accordion - hidden, replaced by Community Outlook */}

        {/* Legacy ownership components - hidden when new ownership data exists */}
        {!hasOwnershipData && (
          <>
            {/* Ownership Trail */}
            {actualId && <OwnershipTrail brandId={actualId} />}

            {/* Ownership Structure */}
            {actualId && <OwnershipGraph brandId={actualId} />}

            {/* Consolidated Scores (if has subsidiaries) */}
            {actualId && <RollupScores brandId={actualId} />}
          </>
        )}

        {/* Evidence - Grouped by Category */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold">Evidence</h3>
              
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'All', value: 'all' },
                  { label: 'Product Safety', value: 'Product Safety' },
                  { label: 'Regulatory', value: 'Regulatory' },
                  { label: 'Legal', value: 'Legal' },
                  { label: 'Labor', value: 'Labor' },
                  { label: 'Financial', value: 'Financial' },
                  { label: 'Policy', value: 'Policy' },
                  { label: 'ESG (Environment)', value: 'ESG (Environment)' },
                  { label: 'Social & Cultural', value: 'Social & Cultural' },
                  { label: 'Noise', value: 'Noise' },
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
              
              {/* Noise tab explainer */}
              {categoryFilter === 'Noise' && (
                <div className="text-xs text-muted-foreground italic p-3 bg-muted/50 rounded-lg border">
                  <span className="font-medium">ℹ️ Market commentary:</span> These events are financial analysis, stock tips, or general business news. They're excluded from ethics scoring to focus on labor, environmental, and social impact.
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Detailed evidence breakdown */}
            <details open>
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Show detailed evidence breakdown
              </summary>
              <div className="mt-4">
            {(() => {
              // Map category codes to groups
              const categoryGroups: Record<string, number> = {
                'Product Safety': 10,
                'Regulatory': 20,
                'Legal': 30,
                'Labor': 40,
                'Financial': 50,
                'Policy': 60,
                'ESG (Environment)': 70,
                'Social & Cultural': 80,
                'Noise': 90
              };

              const codeToGroup: Record<string, string> = {
                'FIN.EARNINGS': 'Financial',
                'FIN.MARKETS': 'Financial',
                'FIN.MNA': 'Financial',
                'FIN.INSTITUTIONAL': 'Financial',
                'FIN.GENERAL': 'Financial',
                'PRODUCT.SAFETY': 'Product Safety',
                'PRODUCT.RECALL': 'Product Safety',
                'LEGAL.LITIGATION': 'Legal',
                'LEGAL.SETTLEMENT': 'Legal',
                'LEGAL.LAWSUIT': 'Legal',
                'REGULATORY.ENFORCEMENT': 'Regulatory',
                'REGULATORY.FILING': 'Regulatory',
                'REGULATORY.EPA': 'Regulatory',
                'REGULATORY.OSHA': 'Regulatory',
                'LABOR.PRACTICES': 'Labor',
                'LABOR.UNION': 'Labor',
                'LABOR.SAFETY': 'Labor',
                'ESG.ENVIRONMENT': 'ESG (Environment)',
                'ESG.SOCIAL': 'Social & Cultural',
                'ENV.POLLUTION': 'ESG (Environment)',
                'ENV.EMISSIONS': 'ESG (Environment)',
                'SOC.CULTURE': 'Social & Cultural',
                'POLICY.PUBLIC': 'Policy',
                'POLICY.POLITICAL': 'Policy',
                'NOISE.GENERAL': 'Noise',
                'NOISE.FINANCIAL': 'Noise'
              };

              // Helper function to determine group from category_code or legacy category
              const getGroupName = (code: string | null, legacyCategory: string | null): string => {
                if (code && codeToGroup[code]) {
                  return codeToGroup[code];
                }
                // Fallback: Check if code starts with a known prefix
                if (code) {
                  const prefix = code.split('.')[0];
                  if (prefix === 'FIN') return 'Financial';
                  if (prefix === 'PRODUCT') return 'Product Safety';
                  if (prefix === 'LEGAL') return 'Legal';
                  if (prefix === 'REGULATORY') return 'Regulatory';
                  if (prefix === 'LABOR') return 'Labor';
                  if (prefix === 'ESG' || prefix === 'ENV') return 'ESG (Environment)';
                  if (prefix === 'SOC') return 'Social & Cultural';
                  if (prefix === 'POLICY') return 'Policy';
                  if (prefix === 'NOISE') return 'Noise';
                }
                // Legacy category fallback
                if (legacyCategory === 'labor') return 'Labor';
                if (legacyCategory === 'environment') return 'ESG (Environment)';
                if (legacyCategory === 'politics') return 'Policy';
                if (legacyCategory === 'social') return 'Social & Cultural';
                return 'Noise';
              };

              const getVerificationRank = (v: string | null) => 
                v === 'official' ? 1 : v === 'corroborated' ? 2 : 3;

              // Add group info to each evidence item
              const evidenceWithGroups = (data.evidence ?? []).map(ev => {
                const groupName = getGroupName(ev.category_code, ev.category);
                return {
                  ...ev,
                  group_name: groupName,
                  group_order: categoryGroups[groupName] ?? 90,
                  verification_rank: getVerificationRank(ev.verification)
                };
              });

              // Cluster duplicate stories by normalized title + canonical URL
              const clusterKey = (ev: any) => {
                const normalized = (ev.title || '').trim().toLowerCase();
                const url = ev.canonical_url || ev.source_url || '';
                return `${normalized}|${url}`;
              };

              const clusterMap = evidenceWithGroups.reduce((acc, ev) => {
                const key = clusterKey(ev);
                if (!acc[key]) {
                  acc[key] = { ...ev, _outlets: new Set(), _count: 0 };
                }
                acc[key]._count++;
                if (ev.source_name) acc[key]._outlets.add(ev.source_name);
                return acc;
              }, {} as Record<string, any>);

              const clusteredEvidence = Object.values(clusterMap);

              // Filter by selected category
              const filteredEvidence = categoryFilter === 'all'
                ? clusteredEvidence
                : clusteredEvidence.filter(e => e.group_name === categoryFilter);

              // Sort: group_order ASC, verification_rank ASC, event_date DESC
              const sortedEvidence = [...filteredEvidence].sort((a, b) => {
                if (a.group_order !== b.group_order) return a.group_order - b.group_order;
                if (a.verification_rank !== b.verification_rank) return a.verification_rank - b.verification_rank;
                return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
              });

              // Group by group_name
              const grouped = sortedEvidence.reduce((acc, ev) => {
                if (!acc[ev.group_name]) acc[ev.group_name] = [];
                acc[ev.group_name].push(ev);
                return acc;
              }, {} as Record<string, typeof sortedEvidence>);

              // Sort groups by group_order
              const groupOrder = Object.keys(grouped).sort((a, b) => 
                (categoryGroups[a] ?? 90) - (categoryGroups[b] ?? 90)
              );

              if (!sortedEvidence.length) {
                const totalEvents = data.evidence?.length || 0;
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    {totalEvents === 0 ? (
                      <p className="text-sm">No evidence available yet for this brand.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          No {categoryFilter} events found
                        </p>
                        <p className="text-xs">
                          {totalEvents} event{totalEvents !== 1 ? 's' : ''} available in other categories.
                          <button 
                            onClick={() => setCategoryFilter('all')}
                            className="ml-2 text-primary hover:underline"
                          >
                            Show all
                          </button>
                        </p>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {groupOrder.map(groupName => (
                    <div key={groupName} className="space-y-3">
                      {/* Group Header */}
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <h4 className="font-semibold text-sm">{groupName}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {grouped[groupName].length}
                        </Badge>
                      </div>
                      
                      {/* Events in this group */}
                      {grouped[groupName].map((ev, idx) => {
                        const isOfficial = ev.verification === 'official';
                        const isCorroborated = ev.verification === 'corroborated';
                        
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
                              
                              {/* Secondary categories */}
                              {(ev as any).secondary_categories?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {(ev as any).secondary_categories.map((secCat: string, idx: number) => (
                                    <Badge 
                                      key={idx}
                                      variant="secondary" 
                                      className="text-xs opacity-70"
                                    >
                                      +{secCat}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              
                              {/* Noise reason tooltip */}
                              {(ev as any).noise_reason && ev.category_code?.startsWith('NOISE') && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs cursor-help">
                                      ℹ️ Not scored
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{(ev as any).noise_reason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(ev.event_date), { addSuffix: true })}
                              </span>
                             </div>
                             
                              {/* Title with outlet count */}
                              <h4 className="font-semibold text-base leading-tight mb-2">
                                {ev.title || 'Untitled Event'}
                                {ev._count > 1 && (
                                  <span className="ml-2 text-xs border rounded-full px-2 py-0.5 text-muted-foreground">
                                    +{ev._count - 1} {ev._count === 2 ? 'outlet' : 'outlets'}
                                  </span>
                                )}
                              </h4>
                             
                             {/* AI Summary */}
                             {ev.ai_summary && (
                               <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                                 {ev.ai_summary}
                               </p>
                             )}
                             
                             {/* Source link and actions */}
                             <div className="space-y-2">
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
                               <div className="flex gap-3 text-xs text-muted-foreground">
                                 <button
                                   onClick={() => {
                                     setSelectedEventId(ev.event_id);
                                     setReportDialogOpen(true);
                                   }}
                                   className="underline hover:text-foreground"
                                 >
                                   Report issue
                                 </button>
                                 <button
                                   onClick={() => setSuggestDialogOpen(true)}
                                   className="underline hover:text-foreground"
                                 >
                                   Suggest evidence
                                 </button>
                               </div>
                             </div>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                  </div>
                ))}
              </div>
            );
          })()}
              </div>
            </details>
          </CardContent>
        </Card>

        {/* Secondary actions */}
        <div className="flex gap-3 justify-center pb-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedEventId(undefined);
              setReportDialogOpen(true);
            }}
          >
            Report an issue
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSuggestDialogOpen(true)}
          >
            Suggest evidence
          </Button>
        </div>
        {/* Report/Suggest dialogs */}
        <ReportIssueDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          brandId={actualId!}
          eventId={selectedEventId}
          brandName={data.brand.name}
        />
        <SuggestEvidenceDialog
          open={suggestDialogOpen}
          onOpenChange={setSuggestDialogOpen}
          brandId={actualId!}
          brandName={data.brand.name}
        />
      </main>
    </div>
  );
}
