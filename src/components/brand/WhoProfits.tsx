import { useRpc } from "@/hooks/useRpc";
import { Building2, AlertTriangle } from "lucide-react";
import { CorporateFamilyTree } from "./CorporateFamilyTree";
import { useOwnership } from "@/hooks/useOwnership";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useTopShareholders } from "@/hooks/useTopShareholders";

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
  
  // Check for shareholders to detect public companies
  const { data: shareholders = [] } = useTopShareholders(brandId, 5);
  const hasSignificantShareholders = shareholders.length > 0;

  if (isLoading || !data) return null;

  // Extract siblings/subsidiaries from ownership data
  const siblings = ownershipData?.structure?.siblings || [];
  const chain = ownershipData?.structure?.chain || [];
  const hasParentInChain = chain.length > 0;
  
  // Detect data inconsistency: if we have siblings but header says "independent"
  // This means the brand IS the parent company (like Kroger itself)
  const isParentCompany = data.is_ultimate_parent && siblings.length > 0;
  
  // Detect public companies: has shareholders OR is a large well-known brand
  const isPublicCompany = hasSignificantShareholders && !data.owner_company_name;
  
  // True independence: no parent AND no siblings/subsidiaries AND not a public company
  const isTrulyIndependent = data.is_ultimate_parent && siblings.length === 0 && !hasParentInChain && !isPublicCompany;
  
  // Incomplete data: we have siblings but no parent resolved
  // (This should be rare if data is correct, but handle it gracefully)
  const hasIncompleteData = !data.is_ultimate_parent && !data.owner_company_name && siblings.length > 0;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Who Benefits from Your Purchase</h3>
      </div>

      {/* Incomplete Data Warning */}
      {hasIncompleteData && (
        <Alert variant="default" className="mb-4 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Sister brands detected but parent company not resolved. Corporate tree may be incomplete.
          </AlertDescription>
        </Alert>
      )}

      {/* Parent Company Display */}
      <div className="mb-6">
        {isParentCompany ? (
          // This brand IS a parent company with subsidiaries
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Parent Company</p>
            <p className="text-lg font-semibold">{brandName}</p>
            <p className="text-xs text-muted-foreground mt-2">
              This is a parent corporation that owns multiple brands and subsidiaries.
            </p>
          </div>
        ) : isPublicCompany ? (
          // Public company: has shareholders, no parent
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-1 font-medium">Public Company</p>
            <p className="text-lg font-semibold">{brandName}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {brandName} is a publicly traded multinational corporation. Ownership is distributed among shareholders.
            </p>
          </div>
        ) : isTrulyIndependent ? (
          // Truly independent: no parent, no siblings, no shareholders
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <p className="text-sm font-medium">Independent Brand</p>
            <p className="text-xs text-muted-foreground mt-1">
              No parent company found. This appears to be an independent operation.
            </p>
          </div>
        ) : data.is_ultimate_parent ? (
          // Ultimate parent but we're not showing subsidiaries label (fallback)
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <p className="text-sm font-medium">Corporate Headquarters</p>
            <p className="text-xs text-muted-foreground mt-1">
              This appears to be the top-level entity in the corporate structure.
            </p>
          </div>
        ) : (
          // Has a parent company
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Revenue flows to</p>
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
        isParentCompany={isParentCompany}
      />
    </Card>
  );
}
