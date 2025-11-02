import { Building2 } from 'lucide-react';
import { useRpc } from '@/hooks/useRpc';

interface OwnershipHeader {
  is_ultimate_parent: boolean;
  owner_company_name: string | null;
  ultimate_parent_name: string | null;
}

interface OwnershipBannerProps {
  brandId: string;
}

export function OwnershipBanner({ brandId }: OwnershipBannerProps) {
  const { data, isLoading } = useRpc<OwnershipHeader>(
    'rpc_get_brand_ownership_header',
    { p_brand_id: brandId },
    { enabled: !!brandId }
  );

  // Parent brand linking removed - company_ownership queries fail with broken foreign keys
  // Links are handled by WhoProfits component using Wikidata integration

  if (isLoading || !data) return null;

  // Ultimate parent badge
  if (data.is_ultimate_parent) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs bg-primary/10 text-primary border border-primary/20">
        <Building2 className="h-3.5 w-3.5" />
        <span className="font-medium">Ultimate Parent</span>
      </div>
    );
  }

  // Display ownership chain (without links since company_ownership queries fail)
  if (data.owner_company_name) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
        <span className="font-medium text-foreground">Owned by</span>
        <span className="text-foreground">{data.owner_company_name ?? '—'}</span>
        {data.ultimate_parent_name && data.ultimate_parent_name !== data.owner_company_name && (
          <>
            <span className="text-muted-foreground/60">•</span>
            <span className="font-medium text-foreground">Ultimate parent:</span>
            <span className="text-foreground">{data.ultimate_parent_name}</span>
          </>
        )}
      </div>
    );
  }

  return null;
}
