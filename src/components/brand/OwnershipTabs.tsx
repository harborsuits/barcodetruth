import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { OwnershipStructure } from "./OwnershipStructure";
import { OwnershipShareholders } from "./OwnershipShareholders";
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
    chainLength: ownership?.structure?.chain?.length,
    shareholdersCount: ownership?.shareholders?.top?.length,
    fullData: ownership
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  if (!ownership) {
    return null;
  }

  const hasStructure = ownership.structure?.chain?.length > 0;
  const hasShareholders = ownership.shareholders?.top && ownership.shareholders.top.length > 0;

  return (
    <Card className="p-6 bg-muted/30 border-2">
      <h3 className="font-bold text-lg mb-4">Ownership</h3>
      
      <Tabs defaultValue="structure" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="shareholders" disabled={!hasShareholders}>
            Shareholders
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="structure" className="mt-0">
          <OwnershipStructure 
            chain={ownership.structure?.chain || []}
            siblings={ownership.structure?.siblings || []}
          />
        </TabsContent>
        
        <TabsContent value="shareholders" className="mt-0">
          {hasShareholders ? (
            <OwnershipShareholders shareholders={ownership.shareholders} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Shareholder data not available for this company.</p>
              <p className="text-sm mt-2">
                Shareholder information is only available for publicly traded companies.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
