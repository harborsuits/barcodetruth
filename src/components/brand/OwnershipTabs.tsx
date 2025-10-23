import { Card } from "@/components/ui/card";
import { UnifiedOwnershipDisplay } from "./UnifiedOwnershipDisplay";
import { useOwnership } from "@/hooks/useOwnership";
import { Skeleton } from "@/components/ui/skeleton";
import { TopShareholdersCard } from "./TopShareholdersCard";
import { KeyPeopleRow } from "./KeyPeopleRow";
import { useTopShareholders } from "@/hooks/useTopShareholders";
import { useKeyPeople } from "@/hooks/useKeyPeople";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OwnershipTabsProps {
  brandId: string;
}

export function OwnershipTabs({ brandId }: OwnershipTabsProps) {
  const { data: ownership, isLoading: ownershipLoading } = useOwnership(brandId);
  const { data: shareholders = [], isLoading: shareholdersLoading } = useTopShareholders(brandId, 10);
  const { data: keyPeople = [], isLoading: peopleLoading } = useKeyPeople(brandId);

  // Fallback company info when ownership RPC returns an empty structure
  const { data: companyInfo, isLoading: companyInfoLoading } = useQuery({
    queryKey: ['company-info-inline', brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_brand_company_info' as any, { p_brand_id: brandId });
      if (error) {
        console.error('[OwnershipTabs] company-info-inline error:', error);
        return null;
      }
      return data as any;
    },
    enabled: !!brandId && (!ownership || !ownership.structure || !(ownership as any).structure?.chain?.length),
    staleTime: 1000 * 60 * 30,
  });

  const isLoading = ownershipLoading || shareholdersLoading || peopleLoading || companyInfoLoading;

  console.log('[OwnershipTabs] Rendering:', { 
    brandId, 
    isLoading,
    hasData: !!ownership,
    shareholdersCount: shareholders.length,
    keyPeopleCount: keyPeople.length,
    ownership 
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="p-6 bg-muted/30 border-2">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-64 w-full" />
        </Card>
        <Card className="p-6 bg-muted/30 border-2">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-32 w-full" />
        </Card>
        <Card className="p-6 bg-muted/30 border-2">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    );
  }

  // Extract the primary company (first in chain) with fallback from company info
  const companyFromOwnership = ownership?.structure?.chain?.[0] || null;
  const companyFallback = (companyInfo as any)?.ownership?.company
    ? {
        id: (companyInfo as any).ownership.company.id ?? `company-${brandId}`,
        name: (companyInfo as any).ownership.company.name,
        type: 'company' as const,
        logo_url: (companyInfo as any).ownership.company.logo_url ?? undefined,
        is_public: (companyInfo as any).ownership.company.is_public ?? undefined,
        ticker: (companyInfo as any).ownership.company.ticker ?? undefined,
      }
    : null;
  const company = companyFromOwnership || companyFallback;
  
  // Prefer structured shareholders from ownership API, fallback to simple top-shareholders hook
  const shareholdersList = (ownership as any)?.shareholders?.top ?? shareholders;
  const normalizedShareholders = (shareholdersList || []).map((h: any) => ({
    name: h.name ?? h.holder_name,
    type: h.type ?? h.holder_type ?? 'institutional',
    percent: typeof h.percent === 'number' ? h.percent : (typeof h.percent_owned === 'number' ? h.percent_owned : undefined),
    official_url: h.official_url ?? h.holder_url,
    wikipedia_url: h.wikipedia_url,
    logo_url: h.logo_url,
    source_name: h.source_name,
    source_url: h.source_url,
  }));
  
  // Extract parent chain (if more than 1 level)
  const parentChain = ownership?.structure?.chain && ownership.structure.chain.length > 1 
    ? ownership.structure.chain 
    : undefined;

  return (
    <div className="space-y-6">
      {/* Ownership Card - always show */}
      <Card className="p-6 bg-muted/30 border-2">
        <h3 className="font-bold text-lg mb-4">Ownership</h3>
        
        {ownership ? (
          <UnifiedOwnershipDisplay
            company={company}
            shareholders={normalizedShareholders}
            ownershipDetails={ownership?.ownership_details}
            parentChain={parentChain}
            siblings={ownership?.structure?.siblings}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No verified ownership structure available yet. Data will appear as soon as we parse filings or parent data.
          </p>
        )}
      </Card>

      {/* Key People Card - always show with empty state */}
      <Card className="p-6 bg-muted/30 border-2">
        <KeyPeopleRow 
          people={keyPeople} 
          emptyMessage="No verified key people yet — we'll show parent data or filings as soon as they're available."
        />
      </Card>

      {/* Top Shareholders Card - always show with empty state */}
      <TopShareholdersCard 
        shareholders={shareholders}
        emptyMessage="Ownership structure will appear as soon as we parse filings or parent data."
      />
    </div>
  );
}
