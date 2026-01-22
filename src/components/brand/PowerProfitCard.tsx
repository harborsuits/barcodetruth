import { Building2, Users, TrendingUp, HelpCircle, RefreshCw, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import { useState } from "react";

interface PowerProfitData {
  brand_id: string;
  brand_name: string;
  company_type: string;
  ownership_confidence: string;
  ticker: string | null;
  exchange: string | null;
  is_public: boolean;
  company_name: string | null;
  company_country: string | null;
  top_holders: Array<{
    name: string;
    type: string | null;
    percent_owned: number | null;
    is_asset_manager: boolean;
    source: string | null;
    as_of: string | null;
  }>;
  leadership: Array<{
    name: string;
    role: string;
    title: string | null;
    image_url: string | null;
    wikidata_qid: string | null;
  }>;
  has_parent: boolean;
  parent_company: {
    id: string;
    name: string;
    ticker: string | null;
    exchange: string | null;
    is_public: boolean;
    relationship: string;
    confidence: number;
  } | null;
}

interface PowerProfitCardProps {
  brandId: string;
  brandName?: string;
}

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  chair: "Chair",
  founder: "Founder",
  board: "Board Member",
};

export function PowerProfitCard({ brandId, brandName }: PowerProfitCardProps) {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['power-profit', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_power_profit', {
        p_brand_id: brandId
      });
      if (error) throw error;
      return data as unknown as PowerProfitData | null;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
  
  const handleRefresh = async () => {
    if (!data?.ticker) {
      toast.error("No ticker available for shareholder sync");
      return;
    }
    
    setIsRefreshing(true);
    try {
      // Sync 13F data for this ticker
      const { error: syncError } = await supabase.functions.invoke('sync-13f', {
        body: { ticker: data.ticker }
      });
      
      if (syncError) throw syncError;
      
      // Re-enrich from Wikidata for leadership
      await supabase.functions.invoke('enrich-brand-wiki', {
        body: { brand_id: brandId, mode: 'full' }
      });
      
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ['power-profit', brandId] });
      toast.success("Ownership data refreshed");
    } catch (err) {
      console.error('Refresh failed:', err);
      toast.error("Failed to refresh ownership data");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return <UnknownOwnershipCard />;
  }

  // Determine what to show based on data
  // Filter holders to only show those with real percentages (non-null, > 0)
  const realHolders = (data.top_holders || []).filter(h => 
    h.percent_owned != null && h.percent_owned > 0
  );
  const hasHolders = realHolders.length > 0;
  const hasLeadership = Boolean(data.leadership && data.leadership.length > 0);
  const confidenceLevel = data.ownership_confidence || 'none';
  
  // Only claim "public" if we have medium+ confidence, or if we have holders/ticker evidence
  const hasPublicEvidence = Boolean(data.ticker) || hasHolders;
  const confidenceAllowsPublicClaim = confidenceLevel === 'high' || confidenceLevel === 'medium';
  const isPublic: boolean = Boolean((data.is_public || data.company_type === 'public') && (confidenceAllowsPublicClaim || hasPublicEvidence));
  
  // Only show parent if confidence is high enough
  const parentConfident = data.parent_company !== null && data.parent_company.confidence >= 0.7;
  const isSubsidiary: boolean = Boolean(data.has_parent) && parentConfident;

  // If no meaningful data, show unknown state
  if (confidenceLevel === 'none' && !hasHolders && !hasLeadership && !isPublic && !isSubsidiary) {
    return <UnknownOwnershipCard />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Power & Profit
          </CardTitle>
          {isAdmin && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ownership Summary */}
        <OwnershipSummary 
          data={data} 
          isPublic={isPublic} 
          isSubsidiary={isSubsidiary}
          hasHolders={hasHolders}
        />

        {/* Top Holders Section - only show holders with real percentages */}
        {hasHolders && (
          <TopHoldersSection holders={realHolders} isPublic={isPublic} />
        )}

        {/* No holders message for public companies */}
        {isPublic && !hasHolders && (
          <NoHoldersMessage exchange={data.exchange} />
        )}

        {/* Leadership Section */}
        {hasLeadership && (
          <LeadershipSection leadership={data.leadership} />
        )}

        {/* Source/Confidence Footer + Data Disclosure */}
        <ConfidenceFooter confidence={confidenceLevel} />
        <DataDisclosure isPublic={isPublic} exchange={data.exchange} />
      </CardContent>
    </Card>
  );
}

function NoHoldersMessage({ exchange }: { exchange: string | null }) {
  const isUS = !exchange || exchange === 'NYSE' || exchange === 'NASDAQ';
  
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
      <p className="text-xs text-muted-foreground">
        {isUS 
          ? "Top holders not yet verified — we're processing SEC filings."
          : `Top holders not available yet for this exchange (${exchange || 'non-US'}). We're adding international filings.`
        }
      </p>
    </div>
  );
}

function OwnershipSummary({ 
  data, 
  isPublic, 
  isSubsidiary,
  hasHolders
}: { 
  data: PowerProfitData; 
  isPublic: boolean; 
  isSubsidiary: boolean;
  hasHolders: boolean;
}) {
  const parentCompany = data.parent_company;
  
  if (isSubsidiary && parentCompany) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-start gap-2">
          <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Revenue flows to → {parentCompany.name}
            </p>
            {parentCompany.is_public && parentCompany.ticker && (
              <p className="text-xs text-muted-foreground mt-1">
                Parent is publicly traded ({parentCompany.exchange}: {parentCompany.ticker})
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isPublic) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-start gap-2">
          <TrendingUp className="h-4 w-4 mt-0.5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Public Company
              {data.ticker && data.exchange && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {data.exchange}: {data.ticker}
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Profits flow to shareholders (institutional funds, insiders, and retail investors)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Private or unknown
  const typeLabel = data.company_type === 'private' 
    ? 'Private Company' 
    : data.company_type === 'cooperative'
    ? 'Cooperative'
    : data.company_type === 'nonprofit'
    ? 'Nonprofit Organization'
    : null;

  if (typeLabel) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-start gap-2">
          <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">{typeLabel}</p>
            {data.company_type === 'private' && (
              <p className="text-xs text-muted-foreground mt-1">
                Ownership details may be limited for private companies
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function TopHoldersSection({ 
  holders,
  isPublic
}: { 
  holders: PowerProfitData['top_holders'];
  isPublic: boolean;
}) {
  const topFive = holders.slice(0, 5);
  const totalPercent = topFive.reduce((sum, h) => sum + (h.percent_owned || 0), 0);
  
  // Determine if these are 13F institutional holders
  const is13FData = holders.some(h => h.source === 'sec_13f');

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        {is13FData ? 'Institutional Holders (13F)' : 'Top Shareholders'}
        {totalPercent > 0 && (
          <span className="text-xs text-muted-foreground font-normal">
            ({totalPercent.toFixed(1)}% combined)
          </span>
        )}
      </h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {topFive.map((holder, idx) => (
          <div 
            key={`${holder.name}-${idx}`}
            className="flex items-center gap-2 p-2 rounded-md bg-background border"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {holder.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{holder.name}</p>
              {holder.percent_owned && (
                <p className="text-xs text-muted-foreground">
                  {holder.percent_owned.toFixed(1)}%
                </p>
              )}
            </div>
            {holder.is_asset_manager && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Fund
              </Badge>
            )}
          </div>
        ))}
      </div>
      {holders.length > 5 && (
        <p className="text-xs text-muted-foreground text-center">
          + {holders.length - 5} more shareholders
        </p>
      )}
    </div>
  );
}

function LeadershipSection({ 
  leadership 
}: { 
  leadership: PowerProfitData['leadership'];
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Leadership</h4>
      <div className="flex flex-wrap gap-2">
        {leadership.map((person, idx) => (
          <div 
            key={`${person.name}-${idx}`}
            className="flex items-center gap-2 p-2 rounded-md bg-background border"
          >
            <Avatar className="h-8 w-8">
              {person.image_url && <AvatarImage src={person.image_url} alt={person.name} />}
              <AvatarFallback className="text-xs">
                {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{person.name}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[person.role] || person.title || person.role}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceFooter({ confidence }: { confidence: string }) {
  const labels: Record<string, string> = {
    high: 'Verified from official filings',
    medium: 'Inferred from public sources',
    low: 'Limited data available',
    none: 'Gathering data...',
  };

  return (
    <p className="text-xs text-muted-foreground pt-2 border-t flex items-center gap-1">
      <HelpCircle className="h-3 w-3" />
      {labels[confidence] || labels.none}
    </p>
  );
}

function DataDisclosure({ isPublic, exchange }: { isPublic: boolean; exchange: string | null }) {
  const isUS = !exchange || exchange === 'NYSE' || exchange === 'NASDAQ';
  
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded p-2">
      <Info className="h-3 w-3 mt-0.5 shrink-0" />
      <p>
        {isPublic 
          ? isUS
            ? "Ownership data from SEC filings (Form 13F). Shows institutional holders with $100M+ in assets."
            : "Ownership data from public disclosures. For non-US companies, institutional holdings may be partial."
          : "Ownership details are limited for private companies."
        }
      </p>
    </div>
  );
}

function UnknownOwnershipCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Ownership
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
          <p className="text-sm font-medium text-muted-foreground">
            Ownership: Not verified yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            We're gathering ownership data for this brand
          </p>
        </div>
        
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Data collection progress:</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
              <span className="text-xs text-muted-foreground">SEC filings — searching</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-muted" />
              <span className="text-xs text-muted-foreground">Company registry — pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-muted" />
              <span className="text-xs text-muted-foreground">News sources — pending</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
