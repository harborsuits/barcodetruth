import { Card } from "@/components/ui/card";
import { UnifiedOwnershipDisplay } from "./UnifiedOwnershipDisplay";
import { useOwnership } from "@/hooks/useOwnership";
import { Skeleton } from "@/components/ui/skeleton";
import { TopShareholdersCard } from "./TopShareholdersCard";
import { KeyPeopleRow } from "./KeyPeopleRow";
import { useTopShareholders } from "@/hooks/useTopShareholders";
import { useKeyPeople } from "@/hooks/useKeyPeople";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface OwnershipTabsProps {
  brandId: string;
}

export function OwnershipTabs({ brandId }: OwnershipTabsProps) {
  const { data: ownership, isLoading: ownershipLoading } = useOwnership(brandId);
  const { data: shareholders = [], isLoading: shareholdersLoading } = useTopShareholders(brandId, 10);
  const { data: keyPeople = [], isLoading: peopleLoading } = useKeyPeople(brandId);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    toast({ title: 'Enriching…', description: 'Fetching key people & shareholders' });
    const { error } = await supabase.functions.invoke('enrich-brand-wiki', {
      body: { brand_id: brandId, mode: 'full' },
    });
    if (error) {
      toast({ title: 'Enrichment failed', description: error.message, variant: 'destructive' });
    } else {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['key-people', brandId] }),
        queryClient.invalidateQueries({ queryKey: ['top-shareholders', brandId] }),
      ]);
      toast({ title: 'Enrichment complete', description: 'Updated people/shareholders' });
    }
  };

  const isLoading = ownershipLoading || shareholdersLoading || peopleLoading;

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

  // Extract the primary company (first in chain)
  const company = ownership?.structure?.chain?.[0] || null;
  
  // Extract parent chain (if more than 1 level)
  const parentChain = ownership?.structure?.chain && ownership.structure.chain.length > 1 
    ? ownership.structure.chain 
    : undefined;

  return (
    <div className="space-y-6">
      {/* Ownership Card - always show */}
      <Card className="p-6 bg-muted/30 border-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Ownership</h3>
          <Button size="sm" variant="secondary" onClick={handleRefresh}>
            Refresh People & Shareholders
          </Button>
        </div>
          {ownership ? (
            <UnifiedOwnershipDisplay
              company={company}
              shareholders={ownership.shareholders?.top}
              ownershipDetails={ownership.ownership_details}
              parentChain={parentChain}
              siblings={ownership.structure?.siblings}
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
