import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Globe, 
  ExternalLink, 
  Calendar, 
  MessageSquarePlus,
  AlertCircle,
  BookOpen,
  Bell,
  Clock,
  CheckCircle2,
  Circle,
  FileSearch
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SuggestEvidenceDialog } from "@/components/SuggestEvidenceDialog";
import { ReportIssueDialog } from "@/components/ReportIssueDialog";
import type { ProfileStateData } from "@/hooks/useProfileState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBrandLogo } from "@/hooks/useBrandLogo";
import { PowerProfitCard } from "@/components/brand/PowerProfitCard";
import { deduplicateEvents, type EventWithSources } from "@/lib/deduplicateEvents";

interface BrandData {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  wikidata_qid?: string | null;
  parent_company?: string | null;
  created_at?: string;
  enrichment_stage?: string | null;
}

interface BuildingProfileProps {
  brand: BrandData;
  stateData: ProfileStateData;
}

function BrandLogo({ brand }: { brand: BrandData }) {
  const displayLogo = useBrandLogo(brand.logo_url || null, brand.website);
  const [imgError, setImgError] = useState(false);

  if (displayLogo && !imgError) {
    return (
      <img
        src={displayLogo}
        alt={`${brand.name} logo`}
        className="w-16 h-16 rounded-xl object-contain bg-muted border"
        onError={() => setImgError(true)}
      />
    );
  }

  // Monogram fallback
  const initials = brand.name
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();

  return (
    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center border">
      <span className="text-xl font-bold text-muted-foreground">{initials}</span>
    </div>
  );
}

// Evidence domain checklist
const EVIDENCE_DOMAINS = [
  { key: 'identity', label: 'Identity', description: 'Company info verified' },
  { key: 'behavior', label: 'Behavior', description: 'Actions & practices tracked' },
  { key: 'claims', label: 'Claims', description: 'Official statements found' },
  { key: 'scrutiny', label: 'Scrutiny', description: 'Media coverage analyzed' },
  { key: 'market', label: 'Market', description: 'Industry position mapped' },
];

function DomainChecklist({ progress }: { progress: ProfileStateData['progress'] }) {
  // Map progress to domain coverage (simplified heuristic)
  const domainStatus = {
    identity: progress.has_description || progress.has_wikidata,
    behavior: progress.dimensions_covered >= 1,
    claims: false, // Would need separate tracking
    scrutiny: progress.total_events >= 3,
    market: progress.has_website,
  };

  const coveredCount = Object.values(domainStatus).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Evidence domains</span>
        <Badge variant="secondary" className="text-xs">
          {coveredCount} of 5 verified
        </Badge>
      </div>
      <div className="space-y-2">
        {EVIDENCE_DOMAINS.map((domain) => {
          const isCovered = domainStatus[domain.key as keyof typeof domainStatus];
          return (
            <div 
              key={domain.key} 
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                isCovered ? 'bg-primary/5' : 'bg-muted/30'
              }`}
            >
              {isCovered ? (
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${isCovered ? 'font-medium' : 'text-muted-foreground'}`}>
                  {domain.label}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  — {domain.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Category to dimension mapping
const CATEGORY_DIMENSIONS: Record<string, { label: string; order: number }> = {
  politics: { label: 'Politics', order: 1 },
  labor: { label: 'Labor', order: 2 },
  environment: { label: 'Environment', order: 3 },
  social: { label: 'Social', order: 4 },
  legal: { label: 'Legal', order: 5 },
  product_safety: { label: 'Product Safety', order: 6 },
  other: { label: 'Other', order: 7 },
};

interface GroupedSignal {
  event_id: string;
  title: string | null;
  event_date: string | null;
  category: string;
  source_url: string | null;
  verification: string | null;
}

function RecentSignals({ brandId }: { brandId: string }) {
  const navigate = useNavigate();
  
  const { data: events, isLoading } = useQuery({
    queryKey: ['brand-signals', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_events')
        .select('event_id, title, event_date, category, source_url, verification')
        .eq('brand_id', brandId)
        .eq('is_irrelevant', false)
        .order('event_date', { ascending: false })
        .limit(30); // Get more to allow for deduplication
      
      if (error) return [];
      
      // Deduplicate similar titles to avoid showing same story multiple times
      return deduplicateEvents(data || []);
    },
    enabled: !!brandId,
  });

  // Get total count
  const { data: countData } = useQuery({
    queryKey: ['brand-signals-count', brandId],
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
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center p-6 bg-muted/30 rounded-lg border border-dashed">
        <FileSearch className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No signals found yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          We're actively searching for news and sources about this brand.
        </p>
      </div>
    );
  }

  // Group events by category/dimension
  const grouped: Record<string, GroupedSignal[]> = {};
  for (const ev of events) {
    const cat = (ev as any).category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(ev as unknown as GroupedSignal);
  }

  // Sort dimensions by predefined order
  const sortedDimensions = (Object.entries(grouped) as [string, GroupedSignal[]][])
    .sort(([a], [b]) => {
      const orderA = CATEGORY_DIMENSIONS[a]?.order ?? 99;
      const orderB = CATEGORY_DIMENSIONS[b]?.order ?? 99;
      return orderA - orderB;
    });

  return (
    <div className="space-y-4">
      {sortedDimensions.map(([category, catEvents]) => (
        <div key={category} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize font-medium">
              {CATEGORY_DIMENSIONS[category]?.label || category}
            </Badge>
            <span className="text-xs text-muted-foreground">
              ({catEvents.length} signal{catEvents.length !== 1 ? 's' : ''})
            </span>
          </div>
          {catEvents.slice(0, 2).map((ev) => {
            const hasUrl = !!ev.source_url;
            return (
              <a 
                key={ev.event_id} 
                href={ev.source_url || '#'} 
                target={hasUrl ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`block p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors ml-2 border-l-2 border-muted ${
                  !hasUrl ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <p className="text-sm font-medium line-clamp-2">{ev.title || 'Untitled event'}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {ev.event_date ? format(new Date(ev.event_date), 'MMM d, yyyy') : 'Date unknown'}
                  </span>
                  {hasUrl && (
                    <span className="text-xs text-primary inline-flex items-center gap-1">
                      Source <ExternalLink className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </a>
            );
          })}
          {catEvents.length > 2 && (
            <p className="text-xs text-muted-foreground ml-4">
              + {catEvents.length - 2} more in this dimension
            </p>
          )}
        </div>
      ))}

      {(countData || 0) > 5 && (
        <Button 
          variant="ghost" 
          className="w-full text-sm"
          onClick={() => navigate(`/brands/${brandId}/proof`)}
        >
          View all {countData} signals →
        </Button>
      )}
    </div>
  );
}

// What's blocking the score - explicit blockers panel
function BlockersPanel({ progress }: { progress: ProfileStateData['progress'] }) {
  const blockers: { label: string; met: boolean }[] = [];
  
  // Check dimension coverage (need 3+ dimensions)
  const dimensionsMet = progress.dimensions_covered >= 3;
  blockers.push({
    label: dimensionsMet 
      ? '3+ evidence dimensions verified' 
      : `${3 - progress.dimensions_covered} more evidence dimension${3 - progress.dimensions_covered !== 1 ? 's' : ''} needed`,
    met: dimensionsMet,
  });
  
  // Check for corroboration (simplified: need 5+ events)
  const corroborationMet = progress.total_events >= 5;
  blockers.push({
    label: corroborationMet 
      ? 'Multiple independent sources confirmed' 
      : 'Corroboration from multiple sources needed',
    met: corroborationMet,
  });
  
  // Check for identity verification
  const identityMet = progress.has_description && progress.has_wikidata;
  blockers.push({
    label: identityMet 
      ? 'Company identity verified' 
      : 'Identity verification pending',
    met: identityMet,
  });

  const allMet = blockers.every(b => b.met);
  
  if (allMet) return null;

  return (
    <Card className="border-muted bg-muted/20">
      <CardContent className="pt-4 pb-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          What's still needed to publish a score
        </h4>
        <div className="space-y-2">
          {blockers.filter(b => !b.met).map((blocker, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <div className="w-5 h-5 rounded-full border-2 border-dashed border-amber-400 flex items-center justify-center">
                <span className="text-xs text-amber-600">⏳</span>
              </div>
              <span className="text-muted-foreground">{blocker.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function BuildingProfile({ brand, stateData }: BuildingProfileProps) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { progress } = stateData;

  // Build bullet points from available data
  const bulletPoints: { icon: typeof Building2; label: string; value: string; link?: string }[] = [];

  if (brand.parent_company) {
    bulletPoints.push({
      icon: Building2,
      label: 'Parent company',
      value: brand.parent_company,
    });
  }

  if (brand.website) {
    const domain = brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    bulletPoints.push({
      icon: Globe,
      label: 'Website',
      value: domain,
      link: brand.website,
    });
  }

  if (brand.wikidata_qid) {
    bulletPoints.push({
      icon: BookOpen,
      label: 'Source',
      value: 'Wikipedia',
      link: `https://www.wikidata.org/wiki/${brand.wikidata_qid}`,
    });
  }

  if (brand.created_at) {
    bulletPoints.push({
      icon: Calendar,
      label: 'Tracking since',
      value: format(new Date(brand.created_at), 'MMM yyyy'),
    });
  }

  // Calculate progress percentage
  const progressPercent = Math.min(
    Math.round(
      ((progress.has_description ? 20 : 0) +
      (progress.has_logo ? 10 : 0) +
      (progress.has_website ? 10 : 0) +
      (progress.total_events >= 3 ? 30 : progress.total_events * 10) +
      (progress.dimensions_covered * 10))
    ),
    100
  );

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Status Banner */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                Profile in progress — rating withheld
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                We've found sources for this brand, but our system requires confirmation across multiple independent domains before publishing a rating.
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
                <span>{stateData.dimensions_with_evidence} of 4 dimensions verified</span>
                <span>•</span>
                <span>{progress.total_events} signals found</span>
                {progress.last_event_at && (
                  <>
                    <span>•</span>
                    <span>Updated {formatDistanceToNow(new Date(progress.last_event_at), { addSuffix: true })}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <BrandLogo brand={brand} />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{brand.name}</h1>
              {brand.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                  {brand.description}
                </p>
              )}
              {!brand.description && (
                <p className="text-sm text-muted-foreground/60 italic mt-2">
                  Description pending verification
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What We Know Card */}
      {bulletPoints.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              What we know so far
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {bulletPoints.map((item, index) => (
                <li key={index} className="flex items-center gap-3 text-sm">
                  <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{item.label}:</span>
                  {item.link ? (
                    <a 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline truncate inline-flex items-center gap-1"
                    >
                      {item.value}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="font-medium truncate">{item.value}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Power & Profit - Who profits from this brand */}
      <PowerProfitCard brandId={brand.id} brandName={brand.name} />

      {/* Verification Progress - Reframed language */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base font-medium">
            <span>Evidence verification</span>
            <Badge variant="secondary" className="text-xs font-normal">
              {progressPercent >= 80 
                ? 'High confidence' 
                : progressPercent >= 50 
                ? 'Building confidence' 
                : 'Gathering evidence'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {progressPercent >= 80 
                ? 'Strong signal volume — awaiting final validation before publishing score'
                : progressPercent >= 50
                ? 'Making progress — need more independent sources to confirm patterns'
                : 'Early stage — actively searching for evidence across multiple domains'}
            </p>
          </div>
          <DomainChecklist progress={progress} />
        </CardContent>
      </Card>

      {/* Recent Signals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base font-medium">
            <span>Recent signals</span>
            <Badge variant="secondary" className="text-xs font-normal">
              {progress.total_events} found
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecentSignals brandId={brand.id} />
        </CardContent>
      </Card>

      {/* What's Blocking - Explicit blockers panel */}
      <BlockersPanel progress={progress} />

      {/* Follow CTA - Smarter language */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Notify me when the score is published</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Our system requires confirmation across multiple domains before publishing a rating. We'll alert you when this brand meets our verification threshold.
              </p>
              <Button size="sm" className="mt-3">
                <Bell className="h-4 w-4 mr-1.5" />
                Get notified
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help CTA */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" />
            Help improve this profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Know something about {brand.name}? Help us verify this brand faster.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSuggestOpen(true)}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Suggest a source
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setReportOpen(true)}
            >
              <AlertCircle className="h-4 w-4 mr-1.5" />
              Report issue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SuggestEvidenceDialog 
        open={suggestOpen} 
        onOpenChange={setSuggestOpen}
        brandId={brand.id}
        brandName={brand.name}
      />
      <ReportIssueDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        brandId={brand.id}
        brandName={brand.name}
      />
    </div>
  );
}
