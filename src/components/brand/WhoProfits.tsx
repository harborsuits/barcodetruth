import { useRpc } from "@/hooks/useRpc";
import { Building2, AlertTriangle, Clock } from "lucide-react";
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
  companyType?: 'public' | 'private' | 'subsidiary' | 'independent' | 'unknown' | null;
}

export function WhoProfits({ brandId, brandName = "This brand", companyType }: WhoProfitsProps) {
  const { data, isLoading } = useRpc<OwnershipHeader>(
    "rpc_get_brand_ownership_header",
    { p_brand_id: brandId }
  );
  
  // Get ownership data from database ONLY - no Wikidata real-time calls
  const { data: ownershipData, isLoading: ownershipLoading } = useOwnership(brandId);
  
  // Check for shareholders to detect public companies (fallback if no companyType)
  const { data: shareholders = [] } = useTopShareholders(brandId, 5);
  const hasSignificantShareholders = shareholders.length > 0;

  if (isLoading || !data) return null;

  // Extract siblings/subsidiaries from ownership data
  const siblings = ownershipData?.structure?.siblings || [];
  const chain = ownershipData?.structure?.chain || [];
  const hasParentInChain = chain.length > 0;
  
  // Priority order for company type detection:
  // 1. Explicit company_type field from database (most reliable)
  // 2. Has shareholders in DB (auto-detected public)
  // 3. Has parent company (subsidiary)
  // 4. Has subsidiaries but no parent (parent company)
  // 5. Fallback: "Ownership data pending" (not "Independent")
  
  // Use database company_type as primary source
  const isExplicitlyPublic = companyType === 'public';
  const isExplicitlyPrivate = companyType === 'private';
  const isExplicitlyIndependent = companyType === 'independent';
  
  // Detect data inconsistency: if we have siblings but header says "independent"
  // This means the brand IS the parent company (like Kroger itself)
  const isParentCompany = data.is_ultimate_parent && siblings.length > 0;
  
  // Detect public companies: explicit field OR has shareholders
  const isPublicCompany = isExplicitlyPublic || (hasSignificantShareholders && !data.owner_company_name && !isExplicitlyPrivate);
  
  // True independence: explicitly marked OR (no parent AND no siblings AND no shareholders AND not explicitly public)
  const isTrulyIndependent = isExplicitlyIndependent || (
    data.is_ultimate_parent && 
    siblings.length === 0 && 
    !hasParentInChain && 
    !isPublicCompany && 
    !isExplicitlyPublic
  );
  
  // Data pending: we don't have enough info to classify and it's not marked
  const isDataPending = !isExplicitlyPublic && 
    !isExplicitlyPrivate && 
    !isExplicitlyIndependent && 
    companyType !== 'subsidiary' &&
    !hasParentInChain && 
    !isPublicCompany && 
    !isParentCompany &&
    siblings.length === 0;
  
  // Incomplete data: we have siblings but no parent resolved
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
          // Public company: has shareholders or explicitly marked
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-1 font-medium">Public Company</p>
            <p className="text-lg font-semibold">{brandName}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {brandName} is a publicly traded multinational corporation. Ownership is distributed among shareholders.
            </p>
          </div>
        ) : data.owner_company_name || hasParentInChain ? (
          // Has a parent company
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Revenue flows to</p>
            <p className="text-lg font-semibold">
              {data.ultimate_parent_name || data.owner_company_name || chain[0]?.name}
            </p>
            {data.owner_company_name && data.ultimate_parent_name && 
             data.owner_company_name !== data.ultimate_parent_name && (
              <p className="text-xs text-muted-foreground mt-2">
                via {data.owner_company_name}
              </p>
            )}
          </div>
        ) : isTrulyIndependent && !isDataPending ? (
          // Truly independent: verified no parent, no siblings, no shareholders
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300 font-medium">Independent Brand</p>
            <p className="text-xs text-muted-foreground mt-1">
              Verified independent operation with no parent company.
            </p>
          </div>
        ) : isDataPending ? (
          // Data pending: we don't have enough info yet
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Ownership Data Pending</p>
            </div>
            <p className="text-xs text-muted-foreground">
              We haven't verified the ownership structure yet. Check back soon.
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
          // Final fallback - shouldn't reach here often
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Ownership Data Pending</p>
            </div>
            <p className="text-xs text-muted-foreground">
              We haven't verified the ownership structure yet. Check back soon.
            </p>
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
