import { Card } from "@/components/ui/card";
import { UnifiedOwnershipDisplay } from "./UnifiedOwnershipDisplay";
import { useOwnership } from "@/hooks/useOwnership";
import { Skeleton } from "@/components/ui/skeleton";
import { TopShareholdersCard } from "./TopShareholdersCard";
import { KeyPeopleRow } from "./KeyPeopleRow";
import { useTopShareholders } from "@/hooks/useTopShareholders";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OwnershipTabsProps {
  brandId: string;
}

export function OwnershipTabs({ brandId }: OwnershipTabsProps) {
  const { data: ownership, isLoading } = useOwnership(brandId);
  const { data: shareholders, isLoading: shareholdersLoading } = useTopShareholders(brandId, 10);
  
  // Fetch key people from company_info
  const { data: companyInfo } = useQuery({
    queryKey: ['company-info', brandId],
    queryFn: async () => {
      if (!brandId) return null;
      const { data, error } = await supabase.rpc('get_brand_company_info', {
        p_brand_id: brandId
      });
      if (error) {
        console.error('[OwnershipTabs] Error fetching company info:', error);
        return null;
      }
      return data as any;
    },
    enabled: !!brandId,
  });

  console.log('[OwnershipTabs] Rendering:', { 
    brandId, 
    isLoading,
    hasData: !!ownership,
    shareholdersCount: shareholders?.length || 0,
    keyPeopleCount: companyInfo?.people?.length || 0,
    ownership 
  });

  if (isLoading) {
    return (
      <Card className="p-6 bg-muted/30 border-2">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (!ownership) {
    console.log('[OwnershipTabs] No ownership data available');
    return null;
  }

  // Extract the primary company (first in chain)
  const company = ownership.structure?.chain?.[0] || null;
  
  // Extract parent chain (if more than 1 level)
  const parentChain = ownership.structure?.chain && ownership.structure.chain.length > 1 
    ? ownership.structure.chain 
    : undefined;

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-muted/30 border-2">
        <h3 className="font-bold text-lg mb-4">Ownership</h3>
        
        <UnifiedOwnershipDisplay
          company={company}
          shareholders={ownership.shareholders?.top}
          ownershipDetails={ownership.ownership_details}
          parentChain={parentChain}
          siblings={ownership.structure?.siblings}
        />
      </Card>

      {/* Key People Card */}
      {companyInfo?.people && companyInfo.people.length > 0 && (
        <Card className="p-6 bg-muted/30 border-2">
          <KeyPeopleRow people={companyInfo.people} />
        </Card>
      )}

      {/* Top Shareholders Card - separate from main ownership */}
      {shareholders && shareholders.length > 0 && (
        <TopShareholdersCard shareholders={shareholders} />
      )}
    </div>
  );
}
