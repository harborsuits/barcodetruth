import { useRpc } from "@/hooks/useRpc";
import { Building2, Network } from "lucide-react";
import { CorporateFamilyTree } from "./CorporateFamilyTree";
import { useOwnership } from "@/hooks/useOwnership";

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
    <div className="rounded-2xl border-2 border-border p-6 bg-card">
      <div className="text-sm text-muted-foreground mb-4">
        Who profits from your purchase
      </div>
      
      <div className="flex items-center gap-3 flex-wrap">
        <Node label="You" />
        <Arrow />
        <Node label={brandName} emphasis />
        
        {!data.is_ultimate_parent && data.owner_company_name && (
          <>
            <Arrow />
            <Node label={data.owner_company_name} />
          </>
        )}
        
        {data.ultimate_parent_name && (
          <>
            <Arrow />
            <Node
              label={data.ultimate_parent_name}
              badge="Ultimate parent"
            />
          </>
        )}
      </div>
      
      <div className="mt-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <strong>Note:</strong> Revenue flows to {data.is_ultimate_parent ? brandName : "controlling entities"} and then to their shareholders (e.g., index funds, institutional investors) who are listed in the shareholders section below.
      </div>

      {/* Corporate Family Tree Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <Network className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Corporate Family</h3>
        </div>

        <CorporateFamilyTree 
          brandName={brandName}
          ownershipData={ownershipData}
          isLoading={ownershipLoading}
        />
      </div>
    </div>
  );
}

function Node({
  label,
  badge,
  emphasis,
}: {
  label: string;
  badge?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-2 border bg-background ${
        emphasis ? "font-semibold shadow-md border-2 border-primary/30" : ""
      }`}
    >
      <div className="text-sm">{label}</div>
      {badge && (
        <div className="mt-1 text-[10px] text-emerald-700 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300 inline-block px-2 py-0.5 rounded-full font-medium">
          {badge}
        </div>
      )}
    </div>
  );
}

function Arrow() {
  return <div className="text-2xl text-muted-foreground">→</div>;
}
