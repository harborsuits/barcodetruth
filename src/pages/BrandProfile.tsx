import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
import { OwnershipBanner } from '@/components/brand/OwnershipBanner';
import { useOwnership } from '@/hooks/useOwnership';
import { useKeyPeople } from '@/hooks/useKeyPeople';
import { useTopShareholders } from '@/hooks/useTopShareholders';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { QuickTakeSnapshot } from '@/components/brand/QuickTakeSnapshot';
import { WhoProfits } from '@/components/brand/WhoProfits';
import { EvidencePanel } from '@/components/brand/EvidencePanel';
import { ValueMatchCard } from '@/components/ValueMatchCard';
import { getUserPreferences } from '@/lib/userPreferences';
import { DataHealthBadge } from '@/components/DataHealthBadge';

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
    
    // Add service worker unregister helper
    (window as any).clearServiceWorkerCache = async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      console.log('Found', regs.length, 'service worker(s)');
      for (const reg of regs) {
        await reg.unregister();
        console.log('Unregistered service worker:', reg.scope);
      }
      console.log('Service workers cleared. Reloading...');
      location.reload();
    };
    
    // Check environment
    console.log('Environment check:', {
      SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      HAS_ANON_KEY: !!import.meta.env.VITE_SUPABASE_ANON_KEY
    });
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

  // Check for key people and shareholders to trigger enrichment
  const { data: keyPeople = [] } = useKeyPeople(actualId);
  const { data: shareholders = [] } = useTopShareholders(actualId, 10);

  // Get current user for personalized scoring
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user);
    });
  }, []);

  // Fetch user preferences for value matching
  const { data: userPreferences } = useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return await getUserPreferences();
    },
    enabled: !!user?.id,
  });

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

  // Fetch community ratings to determine if we have enough data for scores
  const RATING_THRESHOLD = 25;
  const { data: communityOutlook } = useQuery({
    queryKey: ['community-outlook', actualId],
    queryFn: async () => {
      if (!actualId) return null;
      const { data, error } = await supabase.functions.invoke('community-outlook', {
        body: { brand_id: actualId },
      });
      if (error) {
        console.error('Error fetching community outlook:', error);
        return null;
      }
      return data;
    },
    enabled: !!actualId,
  });

  const totalCommunityRatings = communityOutlook?.categories?.reduce((sum: number, cat: any) => sum + (cat.n || 0), 0) || 0;
  const hasEnoughRatings = totalCommunityRatings >= RATING_THRESHOLD;

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

  // Coverage calculation - needs to be before health check
  const coverage = data?.coverage ?? {
    events_7d: 0,
    events_30d: 0,
    events_90d: 0,
    events_365d: 0,
    verified_rate: 0,
    independent_sources: 0,
    last_event_at: null
  };

  // SELF-HEALING HEALTH CHECK - Runs ONCE on page load to ensure brand completeness
  const hasRunHealthCheck = useRef(false);
  
  useEffect(() => {
    if (!actualId || !data?.brand || hasRunHealthCheck.current) return;

    const healthCheck = async () => {
      hasRunHealthCheck.current = true; // Prevent re-runs
      console.log('[Health Check] Analyzing brand:', data.brand?.name);

      // Fetch wikidata_qid separately since it's not in brand_profile_view response
      const { data: brandData } = await supabase
        .from('brands')
        .select('wikidata_qid')
        .eq('id', actualId)
        .single();
      
      const wikidataQid = brandData?.wikidata_qid;
      console.log('[Health Check] Wikidata QID:', wikidataQid);

      // Define what "complete" means for a brand
      const checks = {
        hasCorporateFamily: !!ownership?.structure?.chain?.length || !!ownership?.shareholders?.top?.length,
        hasKeyPeople: keyPeople.length > 0,
        hasShareholderData: shareholders.length > 0,
        hasLogo: !!data.brand?.logo_url,
        hasDescription: !!data.brand?.description,
        hasMinimumEvents: (coverage.events_90d ?? 0) >= 5
      };

      const isComplete = Object.values(checks).every(Boolean);

      if (isComplete) {
        console.log('[Health Check] ✓ Brand is complete');
        return;
      }

      console.log('[Health Check] ⚠ Missing data:', 
        Object.entries(checks)
          .filter(([_, value]) => !value)
          .map(([key]) => key)
      );

      console.log('[Health Check] 🔧 Triggering auto-fix...');

      // TRIGGER ALL MISSING ENRICHMENTS IN PARALLEL
      const promises: Promise<any>[] = [];

      // TWO-STEP ENRICHMENT PROCESS
      // STEP 1: Seed base data (creates foundation)
      // STEP 2: Enrich details (adds people/shareholders)
      
      if (!checks.hasCorporateFamily || !checks.hasKeyPeople || !checks.hasShareholderData) {
        console.log('[Health Check] → Running enrichment sequence (seed → enrich)');
        promises.push(
          supabase.functions.invoke('seed-brand-base-data', {
            body: { 
              brand_id: actualId,
              brand_name: data.brand.name,
              wikidata_qid: wikidataQid
            }
          })
          .then(() => {
            console.log('[Health Check] ✓ Base data seeded');
            return supabase.functions.invoke('enrich-brand-wiki', {
              body: { 
                brand_id: actualId,
                wikidata_qid: wikidataQid,
                mode: 'full'
              }
            });
          })
          .then(() => console.log('[Health Check] ✓ Enrichment complete'))
          .catch(err => console.error('[Health Check] ✗ Enrichment failed:', err))
        );
      } else if (!checks.hasDescription) {
        console.log('[Health Check] → Fixing description only');
        promises.push(
          supabase.functions.invoke('enrich-brand-wiki', {
            body: { 
              brand_id: actualId,
              wikidata_qid: wikidataQid
            }
          }).catch(err => console.error('[Health Check] Description fix failed:', err))
        );
      }

      if (!checks.hasLogo) {
        console.log('[Health Check] → Fixing logo');
        promises.push(
          supabase.functions.invoke('resolve-brand-logo', {
            body: { brand_id: actualId }
          }).catch(err => console.error('[Health Check] Logo failed:', err))
        );
      }

      if (!checks.hasMinimumEvents) {
        console.log('[Health Check] → Queuing news ingestion');
        promises.push(
          supabase.functions.invoke('trigger-brand-ingestion', {
            body: { 
              brand_id: actualId,
              brand_name: data.brand.name,
              priority: 'high'
            }
          }).catch(err => console.error('[Health Check] News ingestion failed:', err))
        );
      }

      // Execute all fixes in parallel
      await Promise.allSettled(promises);

      // Refetch data after enrichment completes
      setTimeout(() => {
        console.log('[Health Check] 🔄 Refetching data...');
        setRefreshKey(k => k + 1);
        refetchCompanyInfo();
        queryClient.invalidateQueries({ queryKey: ['key-people', actualId] });
        queryClient.invalidateQueries({ queryKey: ['top-shareholders', actualId] });
        queryClient.invalidateQueries({ queryKey: ['brand-ownership', actualId] });
      }, 5000);
    };

    // Run health check once on mount
    const timer = setTimeout(healthCheck, 2000);
    return () => clearTimeout(timer);
  }, [actualId, data?.brand]); // Only depend on brand ID and initial data

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
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

  // Create monogram from brand name
  const monogram = data.brand.name?.[0]?.toUpperCase() ?? 'B';

  return (
    <div className="min-h-screen bg-background">
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
              <div className="flex-1 min-w-0 space-y-2">
                <h2 className="text-2xl font-bold truncate">{data.brand.name}</h2>
                
                {/* Ownership banner */}
                {actualId && <OwnershipBanner brandId={actualId} />}
                
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
                    <p>
                      {data.brand.description.length > 200 
                        ? `${data.brand.description.substring(0, 200)}...` 
                        : data.brand.description}
                    </p>
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
                
                {/* Data Health Badge */}
                <div className="mt-4">
                  <DataHealthBadge
                    lastIngestIso={coverage.last_event_at}
                    eventsCount={coverage.events_90d}
                    sourcesCount={coverage.independent_sources}
                  />
                </div>
              </div>
              {/* Overall company score hidden - replaced by Community Outlook */}
            </div>
          </CardContent>
        </Card>

        {/* 2) Quick Take Snapshot */}
        <SectionHeader>How is {data.brand.name} doing overall?</SectionHeader>
        <QuickTakeSnapshot brandId={actualId!} />

        {/* Value Match Analysis - Personalized for User */}
        {userPreferences && data.score && (
          userPreferences.value_labor !== undefined &&
          userPreferences.value_environment !== undefined &&
          userPreferences.value_politics !== undefined &&
          userPreferences.value_social !== undefined &&
          data.score.score_labor !== null &&
          data.score.score_environment !== null &&
          data.score.score_politics !== null &&
          data.score.score_social !== null
        ) && (
          <>
            <SectionHeader>Does {data.brand.name} match your values?</SectionHeader>
            <ValueMatchCard
              userValues={{
                value_labor: userPreferences.value_labor,
                value_environment: userPreferences.value_environment,
                value_politics: userPreferences.value_politics,
                value_social: userPreferences.value_social,
              }}
              brandScores={{
                score_labor: data.score.score_labor,
                score_environment: data.score.score_environment,
                score_politics: data.score.score_politics,
                score_social: data.score.score_social,
              }}
              brandName={data.brand.name}
              brandId={data.brand.id}
            />
          </>
        )}

        {/* 3) Who Profits */}
        <SectionHeader>Who owns {data.brand.name}?</SectionHeader>
        <WhoProfits brandId={actualId!} brandName={data.brand.name} />

        {/* 5) Detailed Category Scores */}
        <SectionHeader>How is {data.brand.name} rated by category?</SectionHeader>
        <div className="grid grid-cols-2 gap-4">
          <CategoryScoreCard 
            category="labor" 
            score={personalizedScore?.score_labor ?? data.score?.score_labor ?? 50}
            eventCount={data.evidence?.filter(e => e.category === 'labor').length || 0}
            onClick={() => setCategoryFilter('labor')}
            hasEnoughRatings={hasEnoughRatings}
          />
          <CategoryScoreCard 
            category="environment" 
            score={personalizedScore?.score_environment ?? data.score?.score_environment ?? 50}
            eventCount={data.evidence?.filter(e => e.category === 'environment').length || 0}
            onClick={() => setCategoryFilter('environment')}
            hasEnoughRatings={hasEnoughRatings}
          />
          <CategoryScoreCard 
            category="politics" 
            score={personalizedScore?.score_politics ?? data.score?.score_politics ?? 50}
            eventCount={data.evidence?.filter(e => e.category === 'politics').length || 0}
            onClick={() => setCategoryFilter('politics')}
            hasEnoughRatings={hasEnoughRatings}
          />
          <CategoryScoreCard 
            category="social" 
            score={personalizedScore?.score_social ?? data.score?.score_social ?? 50}
            eventCount={data.evidence?.filter(e => e.category === 'social').length || 0}
            onClick={() => setCategoryFilter('social')}
            hasEnoughRatings={hasEnoughRatings}
          />
        </div>

        {/* 6) Who's Behind the Brand - Ownership, People, Shareholders */}
        <SectionHeader>Who's behind {data.brand.name}?</SectionHeader>
        {actualId && (
          <OwnershipTabs brandId={actualId} />
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

            {/* Consolidated Scores (if has subsidiaries) */}
            {actualId && <RollupScores brandId={actualId} />}
          </>
        )}

        {/* 4) Community Rating Card - Prominent */}
        <SectionHeader>Share Your Experience</SectionHeader>
        <CommunityOutlookCard brandId={actualId!} brandName={data.brand.name} />

        {/* 5) What's Happening - Evidence */}
        <SectionHeader>What's happening at {data.brand.name}?</SectionHeader>
        <EvidencePanel
          evidence={data.evidence || []}
          onReport={(eventId) => {
            setSelectedEventId(eventId);
            setReportDialogOpen(true);
          }}
          onSuggest={() => setSuggestDialogOpen(true)}
        />

        {/* 7) Can You Trust This Data? - Data Collection Badge */}
        <SectionHeader>Can you trust this data?</SectionHeader>
        {confidenceData && (
          <div className="mb-10">
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
          </div>
        )}

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
