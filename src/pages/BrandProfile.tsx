import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { usePreloadRelated } from '@/hooks/usePreloadRelated';
import { usePredictiveCache } from '@/hooks/usePredictiveCache';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ExternalLink, AlertCircle, Building2, Link as LinkIcon, Lightbulb } from 'lucide-react';
import { DataCompletenessBadge } from '@/components/brand/DataCompletenessBadge';
import { ManualEnrichButton } from '@/components/brand/ManualEnrichButton';
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
import { TopInvestorsSection } from '@/components/brand/TopInvestorsSection';
import { KeyPeopleRow } from '@/components/brand/KeyPeopleRow';
import { ValuationChip } from '@/components/brand/ValuationChip';
import { CommunityOutlookCard } from '@/components/brand/CommunityOutlookCard';
import { OwnershipBanner } from '@/components/brand/OwnershipBanner';
import { useOwnership } from '@/hooks/useOwnership';
import { useKeyPeople } from '@/hooks/useKeyPeople';
import { useTopShareholders } from '@/hooks/useTopShareholders';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { PersonalizedScoreCard } from '@/components/brand/PersonalizedScoreCard';
import { WhoProfits } from '@/components/brand/WhoProfits';
import { EvidencePanel } from '@/components/brand/EvidencePanel';
import { ValueMatchCard } from '@/components/ValueMatchCard';
import { getUserPreferences } from '@/lib/userPreferences';
import { DataHealthBadge } from '@/components/DataHealthBadge';
import { AlternativeCard } from '@/components/brand/AlternativeCard';
import { ReEnrichButton } from '@/components/brand/ReEnrichButton';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { isUUID } from '@/lib/utils';
import { usePersonalizedScore } from '@/hooks/usePersonalizedScore';

// Hardcoded alternatives mapping for major brands
const BRAND_ALTERNATIVES: Record<string, Array<{
  brand_id: string;
  brand_name: string;
  reason: string;
  match_score: number;
  logo_url?: string;
}>> = {
  'skippy': [
    { brand_id: '00000000-0000-0000-0000-000000000001', brand_name: 'Jif Natural', reason: 'No hydrogenated oils', match_score: 85 },
    { brand_id: '00000000-0000-0000-0000-000000000002', brand_name: 'Teddie All Natural', reason: 'Worker-owned cooperative', match_score: 92 },
    { brand_id: '00000000-0000-0000-0000-000000000003', brand_name: 'Santa Cruz Organic', reason: 'Organic & fair trade', match_score: 88 },
  ],
  'coca-cola': [
    { brand_id: '00000000-0000-0000-0000-000000000004', brand_name: 'Honest Tea', reason: 'Organic ingredients', match_score: 85 },
    { brand_id: '00000000-0000-0000-0000-000000000005', brand_name: 'LaCroix', reason: 'Independent, no sugar', match_score: 90 },
    { brand_id: '00000000-0000-0000-0000-000000000006', brand_name: 'Spindrift', reason: 'Real fruit, B-Corp', match_score: 93 },
  ],
  'nestle': [
    { brand_id: '00000000-0000-0000-0000-000000000007', brand_name: "Tony's Chocolonely", reason: 'Slave-free supply chain', match_score: 98 },
    { brand_id: '00000000-0000-0000-0000-000000000008', brand_name: 'Endangered Species Chocolate', reason: 'Fair trade, ethical', match_score: 95 },
  ],
};

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
  const slugOrId = id || brandId;
  const isAdmin = useIsAdmin();
  
  // Determine if we're using UUID or slug
  const isUuidRoute = isUUID(slugOrId);
  const actualId = slugOrId; // Keep for backward compatibility
  
  // Get current location state to check if we came from another brand
  const routerLocation = useLocation();
  const cameFromBrand = (routerLocation as any)?.state?.fromBrand;
  
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
      window.location.reload();
    };
    
    // Check environment
    console.log('Environment check:', {
      SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      HAS_ANON_KEY: !!import.meta.env.VITE_SUPABASE_ANON_KEY
    });
  }, [id, brandId, actualId]);
  
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [hasSetDefaultFilter, setHasSetDefaultFilter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();

  // DIRECT QUERY: Basic brand info - handle both UUID and slug
  const { data: brandInfo, isLoading: brandLoading, error: brandError } = useQuery({
    queryKey: ['brand-basic', actualId, refreshKey],
    enabled: !!actualId,
    queryFn: async () => {
      // Query by UUID or slug depending on route
      const query = isUuidRoute
        ? supabase.from('brands').select('*').eq('id', actualId).single()
        : supabase.from('brands').select('*').eq('slug', actualId).single();
      
      const { data, error } = await query;
      if (error) throw error;
      
      // DEBUG: Log what we got
      console.log('[BrandProfile] Brand data loaded:', data);
      return data;
    }
  });

  // Get the actual UUID from brandInfo (resolved from slug if needed)
  const resolvedBrandId = brandInfo?.id;

  // Enable smart pre-loading and predictive caching (only after we have UUID)
  usePreloadRelated({ brandId: resolvedBrandId });
  usePredictiveCache(resolvedBrandId);

  // Check for new ownership data to hide legacy cards (use resolved UUID)
  const { data: ownership } = useOwnership(resolvedBrandId);
  const hasOwnershipData = 
    (ownership?.structure?.chain?.length ?? 0) > 1 ||
    (ownership?.shareholders?.top?.length ?? 0) > 0;

  // Check for key people and shareholders to trigger enrichment (use resolved UUID)
  const { data: keyPeople = [] } = useKeyPeople(resolvedBrandId);
  const { data: shareholders = [] } = useTopShareholders(resolvedBrandId, 10);

  // Get current user for personalized scoring
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user);
    });
  }, []);

  // Fetch personalized score if user is logged in
  const { data: personalizedScore } = usePersonalizedScore(resolvedBrandId, user?.id);

  // Redirect UUID route to canonical slug once loaded
  useEffect(() => {
    if (isUuidRoute && brandInfo?.slug && brandInfo.slug !== actualId) {
      navigate(`/brand/${brandInfo.slug}`, { replace: true, state: { fromBrand: brandInfo.name } });
    }
  }, [isUuidRoute, brandInfo?.slug, brandInfo?.name, actualId, navigate]);

  // Check data completeness (no longer auto-enriching on page load)
  const hasLogo = !!brandInfo?.logo_url;
  const hasDescription = !!brandInfo?.description;
  const hasWikidataQid = !!brandInfo?.wikidata_qid;

  // Removed auto-enrichment on page load - now user-controlled via ManualEnrichButton

  // DIRECT QUERY: Brand scores (use resolved UUID)
  const { data: brandScores, isLoading: scoresLoading } = useQuery({
    queryKey: ['brand-scores-direct', resolvedBrandId, refreshKey],
    enabled: !!resolvedBrandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_scores')
        .select('score, score_labor, score_environment, score_politics, score_social, last_updated, reason_json')
        .eq('brand_id', resolvedBrandId)
        .order('last_updated', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // DIRECT QUERY: Brand events/evidence (use resolved UUID)
  const { data: evidence, isLoading: evidenceLoading } = useQuery({
    queryKey: ['brand-evidence-direct', resolvedBrandId, refreshKey],
    enabled: !!resolvedBrandId,
    queryFn: async () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('brand_events')
        .select(`
          event_id,
          title,
          event_date,
          category,
          category_code,
          verification,
          description,
          ai_summary,
          event_sources!inner(source_name, canonical_url)
        `)
        .eq('brand_id', resolvedBrandId)
        .gte('event_date', ninetyDaysAgo)
        .order('event_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Transform to match expected structure
      return (data || []).map(event => ({
        event_id: event.event_id,
        title: event.title,
        event_date: event.event_date,
        category: event.category,
        category_code: event.category_code,
        verification: event.verification,
        ai_summary: event.ai_summary,
        source_name: event.event_sources?.[0]?.source_name || null,
        canonical_url: event.event_sources?.[0]?.canonical_url || null
      }));
    }
  });

  // Calculate coverage stats from evidence
  const coverage = useMemo(() => {
    if (!evidence) return {
      events_7d: 0,
      events_30d: 0,
      events_90d: 0,
      events_365d: 0,
      verified_rate: 0,
      independent_sources: 0,
      last_event_at: null
    };

    const now = Date.now();
    const day7 = now - 7 * 24 * 60 * 60 * 1000;
    const day30 = now - 30 * 24 * 60 * 60 * 1000;
    const day90 = now - 90 * 24 * 60 * 60 * 1000;
    
    const events7d = evidence.filter(e => new Date(e.event_date).getTime() >= day7).length;
    const events30d = evidence.filter(e => new Date(e.event_date).getTime() >= day30).length;
    const events90d = evidence.length;
    
    const verified = evidence.filter(e => e.verification === 'official').length;
    const verifiedRate = events90d > 0 ? verified / events90d : 0;
    
    const uniqueSources = new Set(evidence.map(e => e.source_name).filter(Boolean)).size;
    
    const lastEvent = evidence.length > 0 ? evidence[0].event_date : null;

    return {
      events_7d: events7d,
      events_30d: events30d,
      events_90d: events90d,
      events_365d: events90d, // Using 90d as proxy
      verified_rate: verifiedRate,
      independent_sources: uniqueSources,
      last_event_at: lastEvent
    };
  }, [evidence]);

  // Combine into data object for backward compatibility
  const data = useMemo<BrandProfile | null>(() => {
    if (!brandInfo) return null;
    
    return {
      brand: {
        id: brandInfo.id,
        name: brandInfo.name,
        website: brandInfo.website,
        logo_url: brandInfo.logo_url,
        description: brandInfo.description,
        description_source: brandInfo.description_source,
        parent_company: brandInfo.parent_company,
        logo_attribution: brandInfo.logo_attribution
      },
      score: brandScores ? {
        score: brandScores.score,
        score_labor: brandScores.score_labor,
        score_environment: brandScores.score_environment,
        score_politics: brandScores.score_politics,
        score_social: brandScores.score_social,
        updated_at: brandScores.last_updated,
        reason_json: brandScores.reason_json
      } : null,
      coverage,
      evidence: evidence || [],
      ownership: null // Using new ownership system
    };
  }, [brandInfo, brandScores, coverage, evidence]);

  const loading = brandLoading || scoresLoading || evidenceLoading;
  const error = brandError ? (brandError as Error).message : null;

  // Fetch user preferences for value matching and personalization
  const { data: userPreferences } = useQuery({
    queryKey: ['user-value-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_profiles')
        .select('cares_labor, cares_environment, cares_politics, cares_social')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Auto-switch to Noise tab if all events are noise (only on initial load)
  useEffect(() => {
    if (!evidence || hasSetDefaultFilter || loading) return;
    
    const nonNoiseEvents = evidence.filter(ev => 
      !ev.category_code?.startsWith('NOISE')
    );
    
    // If all events are noise, default to Noise tab
    if (evidence.length > 0 && nonNoiseEvents.length === 0) {
      setCategoryFilter('Noise');
    }
    
    setHasSetDefaultFilter(true);
  }, [evidence, hasSetDefaultFilter, loading]);

  // Fetch data confidence to determine if we show scores or monitoring badge
  const { data: confidenceData } = useQuery({
    queryKey: ['brand-confidence', resolvedBrandId],
    queryFn: async () => {
      if (!resolvedBrandId) return null;
      
      // Use raw fetch until types are updated
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/brand_monitoring_status?brand_id=eq.${resolvedBrandId}&select=*`,
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
    enabled: !!resolvedBrandId,
  });

  // ⚠️ DISABLED: community-outlook edge function was boot-looping
  // This caused 500 errors on every page load. Community ratings are not critical
  // for page functionality - they're just used to show/hide rating counts in CategoryScoreCard.
  //
  // TODO: Move to batch job or client-side aggregation
  // const { data: communityOutlook } = useQuery({
  //   queryKey: ['community-outlook', actualId],
  //   queryFn: async () => {
  //     if (!actualId) return null;
  //     const { data, error } = await supabase.functions.invoke('community-outlook', {
  //       body: { brand_id: actualId },
  //     });
  //     if (error) {
  //       console.error('Error fetching community outlook:', error);
  //       return null;
  //     }
  //     return data;
  //   },
  //   enabled: !!actualId,
  // });

  const communityOutlook = null; // Disabled until we implement batch aggregation
  const totalCommunityRatings = 0;
  // Brand scores should display when they exist, regardless of community ratings
  const hasEnoughRatings = true;

  // Fetch company info (ownership, key people, valuation)
  const { data: companyInfo, refetch: refetchCompanyInfo } = useQuery({
    queryKey: ['company-info', resolvedBrandId],
    queryFn: async () => {
      if (!resolvedBrandId) return null;

      const { data, error } = await supabase.rpc('get_brand_company_info', {
        p_brand_id: resolvedBrandId
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
    enabled: !!resolvedBrandId,
  });

  // ⚠️ ARCHITECTURE CHANGE: Removed per-page-load edge function calls
  // 
  // WHY: Multiple edge functions were boot-looping on every page load:
  // ❌ seed-brand-base-data - called on mount if missing data
  // ❌ enrich-brand-wiki - called on mount if missing data  
  // ❌ trigger-brand-ingestion - called on mount if missing events
  // ❌ resolve-brand-logo - called on mount if missing logo
  //
  // This caused:
  // - 🐌 Slow page loads (500ms+ per function call)
  // - 💥 500 errors flooding console
  // - 💸 Wasted edge function invocations
  // - 🔄 Boot-loop crashes
  //
  // NEW ARCHITECTURE:
  // ✅ Client-side logic: useBrandLogo hook, Wikidata integration, direct queries
  // ✅ Batch jobs: nightly-enrichment runs once per day for all brands
  // ✅ Manual triggers: Admin can trigger enrichment for specific brands when needed
  //
  // Data is now enriched via:
  // 1. Nightly batch jobs (batch-resolve-logos, nightly-enrichment)
  // 2. Client-side fallbacks (useBrandLogo for logos)
  // 3. Direct database queries (useWikidataGraph for corporate family)
  // 4. Manual admin triggers (when needed)
  //
  // NO per-page-load edge function calls anymore!

  // Ownership data is fetched via useOwnership hook and displayed via WhoProfits component
  // which uses Wikidata integration (working reliably)

  // Removed auto-logo-enrichment check - now user-controlled via ManualEnrichButton

  // ===== ALL HOOKS MUST BE CALLED ABOVE THIS LINE =====
  // Removed blocking auto-enrichment - show data immediately

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

  // Use personalized score if user is logged in, otherwise fallback to baseline
  const displayScore = personalizedScore ?? brandScores?.score ?? null;
  const baselineScore = brandScores?.score ?? 50;

  // Compute safe display name (no more unnamed brands after migration)
  const displayBrandName = data.brand.name || 'Brand';

  // Create monogram from display name
  const monogram = displayBrandName?.[0]?.toUpperCase() ?? 'B';

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {cameFromBrand && (
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-mt-2 -mb-2 w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to {cameFromBrand}
          </Button>
        )}
        {/* Header with brand info and score */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <BrandLogoWithFallback 
                logoUrl={data.brand.logo_url} 
                website={data.brand.website}
                brandName={displayBrandName}
                monogram={monogram}
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold truncate">{displayBrandName}</h2>
                    <DataCompletenessBadge 
                      hasLogo={hasLogo}
                      hasDescription={hasDescription}
                      hasWikidataQid={hasWikidataQid}
                    />
                  </div>
                  
                  {/* Re-enrich button removed from consumer view - use admin panel instead */}
                </div>
                
                {/* Ownership banner */}
                {resolvedBrandId && <OwnershipBanner brandId={resolvedBrandId} />}
                
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
                  <div className="mt-3">
                    <ManualEnrichButton 
                      brandId={resolvedBrandId}
                      brandName={displayBrandName}
                    />
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
              
              {/* Personalized Score Display */}
              <div className="min-w-[140px] text-right space-y-2">
                {displayScore !== null ? (
                  <>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {user && personalizedScore !== null ? 'Your Score' : 'Baseline Score'}
                      </div>
                      <div className="text-5xl font-bold text-foreground">
                        {Math.round(displayScore)}
                      </div>
                      <div className="text-sm text-muted-foreground">/100</div>
                    </div>
                    
                    {user && personalizedScore !== null && userPreferences && (
                      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                        <div>Baseline: {Math.round(baselineScore)}</div>
                        <div className="text-[10px] leading-tight">
                          Based on your values: Labor {userPreferences.cares_labor}, Env {userPreferences.cares_environment}, Politics {userPreferences.cares_politics}, Social {userPreferences.cares_social}
                        </div>
                      </div>
                    )}
                    
                    {(!user || personalizedScore === null) && (
                      <div className="text-xs text-muted-foreground pt-2">
                        <a href="/settings" className="text-primary hover:underline">
                          Set your values
                        </a> for personalized scores
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Score Status</div>
                    <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-lg">
                      Monitoring in progress — score will appear once enough verified events are collected
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Expanding Banner */}
        {(coverage.events_90d < 20 || !hasDescription || !hasLogo) && (
          <Alert className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Early beta:</strong> Coverage expands weekly. Parent companies and scores for major brands are available today.
            </AlertDescription>
          </Alert>
        )}

        {/* 2) Personalized Score Card */}
        <SectionHeader>
          {user && personalizedScore !== null 
            ? `How does ${displayBrandName} line up with your values?`
            : `How is ${displayBrandName} doing overall?`}
        </SectionHeader>
        <PersonalizedScoreCard
          personalizedScore={personalizedScore}
          baselineScore={baselineScore}
        />

        {/* Value Match Analysis - Personalized for User */}
        {userPreferences && brandScores && (
          userPreferences.cares_labor !== undefined &&
          userPreferences.cares_environment !== undefined &&
          userPreferences.cares_politics !== undefined &&
          userPreferences.cares_social !== undefined &&
          brandScores.score_labor !== null &&
          brandScores.score_environment !== null &&
          brandScores.score_politics !== null &&
          brandScores.score_social !== null
        ) && (
          <>
            <SectionHeader>Does {displayBrandName} match your values?</SectionHeader>
            <ValueMatchCard
              userValues={{
                value_labor: userPreferences.cares_labor,
                value_environment: userPreferences.cares_environment,
                value_politics: userPreferences.cares_politics,
                value_social: userPreferences.cares_social,
              }}
              brandScores={{
                score_labor: brandScores.score_labor,
                score_environment: brandScores.score_environment,
                score_politics: brandScores.score_politics,
                score_social: brandScores.score_social,
              }}
              brandName={displayBrandName}
              brandId={data.brand.id}
            />
          </>
        )}

        {/* Better Alternatives Section */}
        {data.brand.name && (() => {
          const brandKey = data.brand.name.toLowerCase();
          const alternatives = BRAND_ALTERNATIVES[brandKey];
          
          if (!alternatives) return null;
          
          return (
            <>
              <SectionHeader>Better Alternatives to Consider</SectionHeader>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                    <Lightbulb className="w-4 h-4" />
                    <span>These brands align better with ethical consumer values</span>
                  </div>
                  <div className="grid gap-3">
                    {alternatives.map((alt) => (
                      <AlternativeCard
                        key={alt.brand_id}
                        brand_id={alt.brand_id}
                        brand_name={alt.brand_name}
                        reason={alt.reason}
                        match_score={alt.match_score}
                        logo_url={alt.logo_url}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          );
        })()}

        {/* 3) Corporate Ownership Structure */}
        <SectionHeader>Corporate Ownership</SectionHeader>
        <WhoProfits brandId={resolvedBrandId!} brandName={data.brand.name} />

        {/* 5) Detailed Category Scores - Always show objective scores */}
        <SectionHeader>How is {data.brand.name} rated by category?</SectionHeader>
        {brandScores && (brandScores.score_labor !== null || brandScores.score_environment !== null || 
         brandScores.score_politics !== null || brandScores.score_social !== null) ? (
          <div className="grid grid-cols-2 gap-4">
            <CategoryScoreCard 
              category="labor" 
              score={brandScores.score_labor}
              eventCount={data.evidence?.filter(e => e.category === 'labor').length || 0}
              onClick={() => setCategoryFilter('labor')}
              hasEnoughRatings={hasEnoughRatings}
            />
            <CategoryScoreCard 
              category="environment" 
              score={brandScores.score_environment}
              eventCount={data.evidence?.filter(e => e.category === 'environment').length || 0}
              onClick={() => setCategoryFilter('environment')}
              hasEnoughRatings={hasEnoughRatings}
            />
            <CategoryScoreCard 
              category="politics" 
              score={brandScores.score_politics}
              eventCount={data.evidence?.filter(e => e.category === 'politics').length || 0}
              onClick={() => setCategoryFilter('politics')}
              hasEnoughRatings={hasEnoughRatings}
            />
            <CategoryScoreCard 
              category="social" 
              score={brandScores.score_social}
              eventCount={data.evidence?.filter(e => e.category === 'social').length || 0}
              onClick={() => setCategoryFilter('social')}
              hasEnoughRatings={hasEnoughRatings}
            />
          </div>
        ) : (
          <Card className="p-6">
            <p className="font-medium mb-1">Monitoring by category</p>
            <p className="text-sm text-muted-foreground">
              Category scores will appear once enough verified events are collected across each dimension.
            </p>
          </Card>
        )}

        {/* 6) Who Owns the Brand - Corporate Structure */}
        <SectionHeader>Who owns {data.brand.name}?</SectionHeader>
        {resolvedBrandId && (
          <WhoProfits brandId={resolvedBrandId} brandName={displayBrandName} />
        )}

        {/* 7) Top Investors - Separate from Corporate Ownership */}
        <SectionHeader>Who invests in {data.brand.name}?</SectionHeader>
        {resolvedBrandId && (
          <TopInvestorsSection brandId={resolvedBrandId} />
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
            {resolvedBrandId && <OwnershipTrail brandId={resolvedBrandId} />}

            {/* Consolidated Scores (if has subsidiaries) */}
            {resolvedBrandId && <RollupScores brandId={resolvedBrandId} />}
          </>
        )}

        {/* 4) Community Rating Card - Prominent */}
        <SectionHeader>Share Your Experience</SectionHeader>
        <CommunityOutlookCard brandId={resolvedBrandId!} brandName={data.brand.name} />

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
          brandId={resolvedBrandId!}
          eventId={selectedEventId}
          brandName={data.brand.name}
        />
        <SuggestEvidenceDialog
          open={suggestDialogOpen}
          onOpenChange={setSuggestDialogOpen}
          brandId={resolvedBrandId!}
          brandName={data.brand.name}
        />
      </main>
    </div>
  );
}
