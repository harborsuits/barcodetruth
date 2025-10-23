import { useRpc } from "@/hooks/useRpc";

interface OwnershipHeader {
  owner_company_name: string | null;
  ultimate_parent_name: string | null;
  is_ultimate_parent: boolean;
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
        
        {data.ultimate_parent_name &&
          data.ultimate_parent_name !== data.owner_company_name && (
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
        <strong>Note:</strong> Institutional shareholders (e.g., index funds) are
        passive investors and do not control the company. They are listed
        separately in the shareholders section below.
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
