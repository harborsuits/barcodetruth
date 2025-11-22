import { useRpc } from "@/hooks/useRpc";
import { Building2 } from "lucide-react";
import { CorporateFamilyTree } from "./CorporateFamilyTree";
import { useOwnership } from "@/hooks/useOwnership";
import { Card } from "@/components/ui/card";

interface OwnershipHeader {
  is_ultimate_parent: boolean;
  owner_company_name: string | null;
  ultimate_parent_name: string | null;
}

interface WhoProfitsProps {
  brandId: string;
  brandName?: string;
}

export function WhoProfits({ brandId, brandName = "This brand" }: WhoProfitsProps) {
  const { data, isLoading } = useRpc<OwnershipHeader>(
    "rpc_get_brand_ownership_header",
    { p_brand_id: brandId }
  );
  
  // Get ownership data from database ONLY - no Wikidata real-time calls
  const { data: ownershipData, isLoading: ownershipLoading } = useOwnership(brandId);

  if (isLoading || !data) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Corporate Structure</h3>
      </div>

      {/* Parent Company Display */}
      <div className="mb-6">
        {data.is_ultimate_parent ? (
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <p className="text-sm font-medium">Independently Operated</p>
            <p className="text-xs text-muted-foreground mt-1">
              No parent company found in our data. This brand appears to operate independently.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Owned by</p>
            <p className="text-lg font-semibold">
              {data.ultimate_parent_name || data.owner_company_name}
            </p>
            {data.owner_company_name && data.ultimate_parent_name && 
             data.owner_company_name !== data.ultimate_parent_name && (
              <p className="text-xs text-muted-foreground mt-2">
                via {data.owner_company_name}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Subsidiaries/Sister Brands */}
      <CorporateFamilyTree 
        brandName={brandName}
        ownershipData={ownershipData}
        isLoading={ownershipLoading}
      />
    </Card>
  );
}

