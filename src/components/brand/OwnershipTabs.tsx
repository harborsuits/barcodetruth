import { Card } from "@/components/ui/card";
import { UnifiedOwnershipDisplay } from "./UnifiedOwnershipDisplay";
import { useOwnership } from "@/hooks/useOwnership";
import { Skeleton } from "@/components/ui/skeleton";

interface OwnershipTabsProps {
  brandId: string;
}

export function OwnershipTabs({ brandId }: OwnershipTabsProps) {
  const { data: ownership, isLoading } = useOwnership(brandId);

  console.log('[OwnershipTabs] Rendering:', { 
    brandId, 
    isLoading,
    hasData: !!ownership,
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
  );
}
