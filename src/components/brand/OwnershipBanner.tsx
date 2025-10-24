import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OwnershipHeader {
  is_ultimate_parent: boolean;
  owner_company_name: string | null;
  ultimate_parent_name: string | null;
}

interface OwnershipBannerProps {
  brandId: string;
}

export function OwnershipBanner({ brandId }: OwnershipBannerProps) {
  const { data, isLoading } = useQuery<OwnershipHeader>({
    queryKey: ['ownership-header', brandId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/rpc_get_brand_ownership_header`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ p_brand_id: brandId })
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch ownership header');
      const result = await response.json();
      return result?.[0];
    },
    enabled: !!brandId
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
  return (
    <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
      <span className="font-medium text-foreground">Owned by</span>
      <span className="text-foreground">{data.owner_company_name ?? '—'}</span>
      {data.ultimate_parent_name && (
        <>
          <span className="text-muted-foreground/60">•</span>
          <span className="font-medium text-foreground">Ultimate parent:</span>
          <span className="text-foreground">{data.ultimate_parent_name}</span>
        </>
      )}
    </div>
  );
}
