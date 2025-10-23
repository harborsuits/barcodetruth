import { Card } from "@/components/ui/card";
import { UnifiedOwnershipDisplay } from "./UnifiedOwnershipDisplay";
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
  // Single source of truth for ownership
  const { data: ownershipHeader, isLoading: headerLoading } = useQuery({
    queryKey: ['brand-ownership-header', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('rpc_get_brand_ownership_header' as any, { p_brand_id: brandId });
      if (error) throw error;
      return data?.[0];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30,
  });

  const { data: shareholders = [], isLoading: shareholdersLoading } = useTopShareholders(brandId, 10);
  const { data: keyPeople = [], isLoading: peopleLoading } = useKeyPeople(brandId);
  
  // Get subsidiaries/sister brands (for context/reinforcement)
  const { data: subsidiaries, isLoading: subsidiariesLoading } = useQuery({
    queryKey: ['brand-subsidiaries', brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('rpc_get_brand_subsidiaries' as any, { p_brand_id: brandId });
      if (error) throw error;
      return data || [];
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30,
  });

  const isLoading = headerLoading || shareholdersLoading || peopleLoading || subsidiariesLoading;

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

  return (
    <div className="space-y-6">
      {/* Subsidiaries/Sister Brands - only show if there are any to display */}
      {subsidiaries && subsidiaries.length > 0 && (
        <Card className="p-6 bg-muted/30 border-2">
          <UnifiedOwnershipDisplay
            header={ownershipHeader || { 
              brand_id: brandId, 
              is_ultimate_parent: false 
            }}
            subsidiaries={subsidiaries}
          />
        </Card>
      )}

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