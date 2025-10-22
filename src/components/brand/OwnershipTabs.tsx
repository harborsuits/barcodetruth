import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { OwnershipStructure } from "./OwnershipStructure";
import { OwnershipShareholders } from "./OwnershipShareholders";
import { OwnershipDetails } from "./OwnershipDetails";
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
  const hasOwnershipDetails = ownership.ownership_details && ownership.ownership_details.length > 0;
  const companyName = ownership.structure?.chain?.[0]?.name;
  
  // Determine if structure is meaningful (more than just the current entity)
  const hasMeaningfulStructure = hasStructure && ownership.structure.chain.length > 1;
  
  // For employee-owned/private companies with ownership details, prioritize ownership view
  const defaultTab = hasOwnershipDetails ? "ownership" : "structure";
  
  // Determine tab configuration based on available data
  const showOwnershipTab = hasOwnershipDetails;
  const showShareholdersTab = hasShareholders || !hasOwnershipDetails; // Always show for public companies

  return (
    <Card className="p-6 bg-muted/30 border-2">
      <h3 className="font-bold text-lg mb-4">Ownership</h3>
      
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`grid w-full ${showOwnershipTab ? 'grid-cols-3' : 'grid-cols-2'} mb-4`}>
          <TabsTrigger value="structure">
            {hasMeaningfulStructure ? 'Structure' : 'Company'}
          </TabsTrigger>
          {showOwnershipTab && (
            <TabsTrigger value="ownership">
              Ownership
            </TabsTrigger>
          )}
          {showShareholdersTab && (
            <TabsTrigger value="shareholders">
              Shareholders
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="structure" className="mt-0">
          <OwnershipStructure 
            chain={ownership.structure?.chain || []}
            siblings={ownership.structure?.siblings || []}
          />
        </TabsContent>
        
        {showOwnershipTab && (
          <TabsContent value="ownership" className="mt-0">
            <OwnershipDetails 
              ownership_structure={ownership.ownership_structure}
              ownership_details={ownership.ownership_details}
              companyName={companyName}
            />
          </TabsContent>
        )}
        
        {showShareholdersTab && (
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
        )}
      </Tabs>
    </Card>
  );
}
