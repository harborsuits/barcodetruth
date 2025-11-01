import { Building2, ArrowRight } from 'lucide-react';
import { useRpc } from '@/hooks/useRpc';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

  // Get parent brand ID for linking (simplified query)
  const { data: parentBrand } = useQuery({
    queryKey: ['parent-brand', brandId],
    queryFn: async () => {
      // Find parent company
      const { data: ownership } = await supabase
        .from('company_ownership')
        .select('parent_company_id')
        .eq('child_brand_id', brandId)
        .maybeSingle();
      
      if (!ownership?.parent_company_id) return null;
      
      // Find any brand owned by that parent company
      const { data: parentBrandData } = await supabase
        .from('company_ownership')
        .select('brands!child_brand_id(id, name)')
        .eq('parent_company_id', ownership.parent_company_id)
        .limit(1)
        .maybeSingle();
      
      return parentBrandData?.brands;
    },
    enabled: !!brandId && !!data && !data.is_ultimate_parent,
  });

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

  // Ownership chain display  
  if (data.owner_company_name && parentBrand?.id) {
    return (
      <Link
        to={`/brand/${parentBrand.id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <span className="font-medium">Owned by</span>
        <span className="font-semibold group-hover:underline">{data.owner_company_name}</span>
        <ArrowRight className="h-4 w-4" />
        {data.ultimate_parent_name && data.ultimate_parent_name !== data.owner_company_name && (
          <>
            <span className="text-muted-foreground/60">•</span>
            <span className="font-medium">Ultimate parent:</span>
            <span className="font-semibold">{data.ultimate_parent_name}</span>
          </>
        )}
      </Link>
    );
  }

  // Fallback: show text without link
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
